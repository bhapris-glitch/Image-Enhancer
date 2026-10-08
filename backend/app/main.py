import io
import os
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

# Real-ESRGAN is loaded lazily. This keeps the API bootable while dependencies/models
# are being installed and makes the code easy to replace with a hosted inference API.
try:
    import torch
    from realesrgan import RealESRGANer
    from basicsr.archs.rrdbnet_arch import RRDBNet
except Exception:
    torch = None
    RealESRGANer = None
    RRDBNet = None

app = FastAPI(title="Layboka AI Image Enhancer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Lock this to your production frontend domain before launch.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_UPLOAD = 50 * 1024 * 1024
MODEL_PATH = Path(os.getenv("REALESRGAN_MODEL_PATH", "./models/RealESRGAN_x4plus.pth"))
UPSAMPLER = None


def get_upsampler():
    global UPSAMPLER

    if UPSAMPLER is not None:
        return UPSAMPLER

    if RealESRGANer is None or RRDBNet is None or torch is None:
        raise RuntimeError(
            "Real-ESRGAN is not installed. Install requirements and download "
            "RealESRGAN_x4plus.pth into backend/models/."
        )

    if not MODEL_PATH.exists():
        raise RuntimeError(
            f"Missing model weights: {MODEL_PATH}. "
            "Download RealESRGAN_x4plus.pth and place it there."
        )

    model = RRDBNet(
        num_in_ch=3,
        num_out_ch=3,
        num_feat=64,
        num_block=23,
        num_grow_ch=32,
        scale=4,
    )

    UPSAMPLER = RealESRGANer(
        scale=4,
        model_path=str(MODEL_PATH),
        model=model,
        tile=512,
        tile_pad=10,
        pre_pad=0,
        half=bool(torch.cuda.is_available()),
    )
    return UPSAMPLER


def parse_target(target: str):
    targets = {
        "2K": (2048, 1152),
        "4K": (3840, 2160),
        "8K": (7680, 4320),
    }
    if target not in targets:
        raise HTTPException(400, "Target must be 2K, 4K or 8K.")
    return targets[target]


def fit_to_target(w, h, target_w, target_h):
    """
    Preserve aspect ratio and fit the image inside the requested 16:9 canvas.
    The actual image is never stretched.
    """
    scale = min(target_w / w, target_h / h)
    return max(1, round(w * scale)), max(1, round(h * scale))


def smart_preprocess(img, denoise=True, auto_enhance=True, image_type="General"):
    img = ImageOps.exif_transpose(img).convert("RGB")

    # Conservative denoise before super-resolution.
    if denoise:
        arr = np.array(img)
        arr = cv2.fastNlMeansDenoisingColored(arr, None, 3, 3, 7, 21)
        img = Image.fromarray(arr)

    if auto_enhance:
        # Mild dynamic enhancement; intentionally conservative so the AI model
        # remains responsible for detail reconstruction.
        img = ImageEnhance.Contrast(img).enhance(1.04)
        img = ImageEnhance.Color(img).enhance(1.025)

        if image_type == "Portrait":
            img = ImageEnhance.Sharpness(img).enhance(1.04)
        elif image_type == "Product":
            img = ImageEnhance.Contrast(img).enhance(1.03)

    return img


def ai_upscale(img: Image.Image, target_w: int, target_h: int):
    """
    Real-ESRGAN performs learned 4x super-resolution. Because Real-ESRGAN is
    4x, we use it first and then resize to the exact requested output bounds.
    """
    upsampler = get_upsampler()
    arr = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

    try:
        output, _ = upsampler.enhance(arr, outscale=4)
    except RuntimeError as exc:
        # If GPU memory is insufficient, retry on CPU/smaller tile.
        if "out of memory" not in str(exc).lower():
            raise
        upsampler.tile = 256
        output, _ = upsampler.enhance(arr, outscale=4)

    output = cv2.cvtColor(output, cv2.COLOR_BGR2RGB)
    out = Image.fromarray(output)

    final_w, final_h = fit_to_target(out.width, out.height, target_w, target_h)
    out = out.resize((final_w, final_h), Image.Resampling.LANCZOS)
    return out


def final_detail_pass(img, sharpen=True):
    if not sharpen:
        return img
    return img.filter(ImageFilter.UnsharpMask(radius=1.15, percent=85, threshold=3))


def encode(img: Image.Image, output_format: str, quality: int):
    fmt = output_format.lower()
    buf = io.BytesIO()

    if fmt == "jpg":
        img.save(buf, "JPEG", quality=max(60, min(100, quality)), optimize=True, subsampling=0)
        media = "image/jpeg"
        ext = "jpg"
    elif fmt == "png":
        img.save(buf, "PNG", optimize=True)
        media = "image/png"
        ext = "png"
    elif fmt == "webp":
        img.save(buf, "WEBP", quality=max(60, min(100, quality)), method=6)
        media = "image/webp"
        ext = "webp"
    elif fmt == "tiff":
        img.save(buf, "TIFF", compression="tiff_lzw")
        media = "image/tiff"
        ext = "tiff"
    else:
        raise HTTPException(400, "Unsupported output format.")

    return buf.getvalue(), media, ext


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "layboka-ai-image-enhancer",
        "realesrgan_ready": RealESRGANer is not None and MODEL_PATH.exists(),
        "cuda": bool(torch and torch.cuda.is_available()),
    }


@app.post("/api/enhance")
async def enhance(
    file: UploadFile = File(...),
    target: str = Form("8K"),
    output_format: str = Form("jpg"),
    quality: int = Form(95),
    auto_enhance: bool = Form(True),
    sharpen: bool = Form(True),
    denoise: bool = Form(True),
    detail_recovery: bool = Form(True),
    image_type: str = Form("General"),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Uploaded file must be an image.")

    raw = await file.read()
    if len(raw) > MAX_UPLOAD:
        raise HTTPException(413, "Maximum upload size is 50 MB.")

    target_w, target_h = parse_target(target)

    try:
        original = Image.open(io.BytesIO(raw))
        original = ImageOps.exif_transpose(original).convert("RGB")
    except Exception:
        raise HTTPException(400, "The image could not be decoded.")

    # Prevent absurd input dimensions from exhausting memory.
    if original.width * original.height > 80_000_000:
        raise HTTPException(413, "Input image is too large to process safely.")

    prepared = smart_preprocess(
        original,
        denoise=denoise,
        auto_enhance=auto_enhance,
        image_type=image_type,
    )

    try:
        enhanced = ai_upscale(prepared, target_w, target_h)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))

    if detail_recovery:
        enhanced = final_detail_pass(enhanced, sharpen=sharpen)

    data, media, ext = encode(enhanced, output_format, quality)

    return Response(
        content=data,
        media_type=media,
        headers={
            "Content-Disposition": f'attachment; filename="layboka-enhanced-{target.lower()}.{ext}"',
            "X-Output-Width": str(enhanced.width),
            "X-Output-Height": str(enhanced.height),
        },
    )
