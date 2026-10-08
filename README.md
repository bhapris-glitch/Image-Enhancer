# Layboka AI Image Enhancer — Screen 1

A working Screen 1 implementation based on the supplied Layboka AI Image Studio mockup.

## What works

- JPG / PNG / WEBP / TIFF upload
- Drag & drop
- 2K / 4K / 8K target selection
- Auto enhance
- Denoise
- Sharpen
- Detail recovery
- Image type selection
- Before/after slider
- JPG / PNG / WEBP / TIFF output
- Quality control
- Download enhanced image
- Responsive desktop/tablet/mobile UI
- Real-ESRGAN x4 super-resolution backend
- Exact target sizing after AI upscaling

## Architecture

frontend/
  Vite + React + Lucide
backend/
  FastAPI + Pillow + OpenCV + Real-ESRGAN

## 1. Start backend

Python 3.10/3.11 is recommended for the Real-ESRGAN dependency stack.

Windows:

    cd backend
    python -m venv .venv
    .venv\Scripts\activate
    pip install -r requirements.txt

Linux/macOS:

    cd backend
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt

Create:

    backend/models/

Download the official Real-ESRGAN x4plus model weights and place:

    backend/models/RealESRGAN_x4plus.pth

Then:

    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

Check:

    http://localhost:8000/health

## 2. Start frontend

    cd frontend
    npm install
    npm run dev

Vite normally starts at:

    http://localhost:5173

If the backend is hosted elsewhere, create:

    frontend/.env

with:

    VITE_API_URL=https://your-backend-domain.example.com

## 3. Important 8K note

The frontend does not fake 8K. The backend runs Real-ESRGAN x4, then creates the requested output dimensions while preserving aspect ratio.

A 7680x4320 image contains 33,177,600 pixels. Processing several 8K images simultaneously can require substantial RAM/VRAM. For production, use a GPU worker queue rather than processing many jobs inside one web process.

## Production recommendations

1. Put the FastAPI API behind HTTPS.
2. Restrict CORS to your frontend domain.
3. Put enhancement jobs on a queue (Redis + Celery/RQ/Dramatiq).
4. Use a GPU server for 8K jobs.
5. Store uploaded/result files in S3/R2/GCS instead of local disk.
6. Add authentication, per-user quotas and billing.
7. Delete temporary uploads after processing.
8. Add a job ID/progress endpoint for long 8K jobs.
9. Add image metadata stripping for privacy.
10. Add a maximum pixel count and rate limits.

## Why a job queue is recommended

A real 8K enhancement can take seconds to minutes depending on the source, GPU and model. For a production SaaS, the request should become:

POST /api/jobs
  -> queued
  -> GPU worker
  -> object storage
  -> GET /api/jobs/:id
  -> download

The current endpoint is intentionally synchronous so Screen 1 can be tested immediately.
