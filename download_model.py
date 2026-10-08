from pathlib import Path
from urllib.request import urlretrieve

URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/RealESRGAN_x4plus.pth"
OUT = Path(__file__).parent / "models" / "RealESRGAN_x4plus.pth"

OUT.parent.mkdir(parents=True, exist_ok=True)

if OUT.exists():
    print(f"Already exists: {OUT}")
else:
    print("Downloading RealESRGAN_x4plus.pth ...")
    urlretrieve(URL, OUT)
    print(f"Saved to: {OUT}")
