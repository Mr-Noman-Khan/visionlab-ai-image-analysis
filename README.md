# VisionLab

VisionLab is a small image object detection app. Choose a JPG, PNG, or WEBP image and it uses YOLOv8 to find objects, draw boxes around them, and show each label and confidence score.

The project has a React and Vite frontend and a FastAPI backend. The backend loads the YOLO model the first time you run an analysis. That first run may download the `yolov8n.pt` weights, so it needs an internet connection. Later runs use the local copy.

## What you need

- Python 3.10 or 3.11
- Node.js 18 or newer
- An internet connection for installing packages and downloading the model the first time

## Run it on Windows

Start the backend in one PowerShell window:

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If the Python launcher command `py -3.11` is unavailable, use `python -m venv .venv` instead, provided `python` points to Python 3.10 or 3.11.

Then open a second PowerShell window and start the frontend:

```powershell
cd frontend
npm install
npm run dev
```

Open the local address Vite prints, usually `http://localhost:5173`. Keep both terminal windows open while using the app. The frontend sends API requests to the backend on port 8000.

## Run it on macOS or Linux

Start the backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

In another terminal, start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open the local address printed by Vite. The API docs are at `http://127.0.0.1:8000/docs`.

## Using the app

Upload an image, set the confidence threshold, and click **Analyse image**. The results show the annotated image, detected objects, confidence scores, and processing time. Images must be JPG, PNG, or WEBP and no larger than 10 MB.

## API

- `GET /api/health` reports whether the backend is running.
- `POST /api/detect` accepts a multipart upload in the `file` field and an optional `confidence` value between `0.05` and `0.95`.
- `GET /docs` opens the interactive API documentation.

The Vite development server proxies `/api` requests to `http://127.0.0.1:8000`. If you run the API on a different origin, set `VITE_API_BASE_URL` for the frontend and set `VISIONLAB_CORS_ORIGINS` for the backend. See `backend/.env.example` for the backend settings.

## Troubleshooting

- If `npm` is not recognized, install Node.js and reopen PowerShell.
- If Python package installation fails, use Python 3.10 or 3.11 in a new virtual environment.
- The first model download can take a while. If it fails, check your internet connection and try again.
- If a port is already in use, stop the other process or update the port in the server command and the Vite proxy configuration.
- If PowerShell blocks virtual environment activation, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in that window and activate it again.

This is a demo project using a pretrained COCO model. Its detections can be wrong, and it is not intended for safety-critical use or identifying people.
