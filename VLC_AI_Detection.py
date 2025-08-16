import os
import glob
import subprocess
import requests
import json
import time
from uuid import uuid4
from flask import Flask, request, jsonify
import logging
from flask_cors import CORS
from werkzeug.utils import secure_filename

FFMPEG_BIN = r"C:\ffmpeg\ffmpeg.exe"    # <-- set to your actual ffmpeg path
FFPROBE_BIN = r"C:\ffmpeg\ffprobe.exe"  # <-- set to your actual ffprobe path


app = Flask(__name__)
CORS(app)

# Configure logging (absolute path is optional)
logging.basicConfig(filename='process_video.log', level=logging.DEBUG, format='%(asctime)s %(message)s')

# Folders (make sure they exist and are writable)
UPLOAD_DIR = r"C:\nginx\php\uploads"
OUTPUT_DIR = r"C:\Users\asus\Desktop\VLCProject\Frames"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Sightengine API parameters (keep secret in env in production)
SIGHTENGINE_PARAMS = {
    'models': 'genai',
    'api_user': '819870886',
    'api_secret': 'Ev7qjY9qPvxBR3P5TjzcnQPK5FJptQsy'
}


def get_video_duration(input_file):
    """Get the duration of the video in seconds using ffprobe (explicit path)."""
    if not os.path.exists(input_file):
        raise FileNotFoundError(f"Input video missing: {input_file}")

    if not os.path.exists(FFPROBE_BIN):
        raise FileNotFoundError(f"ffprobe executable not found at: {FFPROBE_BIN}")

    try:
        result = subprocess.run(
            [FFPROBE_BIN, '-v', 'error', '-select_streams', 'v:0',
             '-show_entries', 'format=duration',
             '-of', 'default=noprint_wrappers=1:nokey=1', input_file],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True
        )
        out = result.stdout.decode().strip()
        if not out:
            raise ValueError(f"No duration returned. stderr: {result.stderr.decode().strip()}")
        return float(out)
    except FileNotFoundError:
        # ffprobe executable itself not found
        logging.exception("ffprobe not found (FileNotFoundError). Check path or PATH.")
        raise
    except subprocess.CalledProcessError as e:
        logging.exception("ffprobe failed: %s", e.stderr.decode(errors='ignore'))
        raise



def process_video(input_file, output_directory, num_frames=20):
    """Extract frames using explicit ffmpeg path."""
    if not os.path.exists(FFMPEG_BIN):
        logging.error("ffmpeg not found at: %s", FFMPEG_BIN)
        return False

    try:
        duration = get_video_duration(input_file)
    except Exception as e:
        logging.error("Error getting video duration: %s", e)
        return False

    if duration <= 0:
        logging.error("Video duration invalid: %s", duration)
        return False

    interval = duration / float(num_frames)

    # clear old frames
    for old in glob.glob(os.path.join(output_directory, "frame_*.png")):
        try:
            os.remove(old)
        except Exception:
            pass

    ffmpeg_cmd = [
        FFMPEG_BIN, '-y', '-i', input_file,
        '-vf', f'fps=1/{interval}', '-vsync', 'vfr',
        os.path.join(output_directory, 'frame_%04d.png')
    ]

    logging.info("Running ffmpeg: %s", " ".join(ffmpeg_cmd))
    proc = subprocess.Popen(ffmpeg_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    out, err = proc.communicate()
    if proc.returncode != 0:
        logging.error("ffmpeg failed: %s", err.decode(errors='ignore'))
        return False

    return True


@app.route('/process_video_and_ai_detection', methods=['POST'])
def run_script():
    logging.info("Received request to /process_video_and_ai_detection")

    # 1) Ensure a file was uploaded
    if 'video' not in request.files:
        logging.error("No 'video' field in request.files")
        return jsonify({'error': "No video uploaded (field name must be 'video')."}), 400

    video_file = request.files['video']
    if video_file.filename == '':
        logging.error("Uploaded video has empty filename")
        return jsonify({'error': 'Empty filename.'}), 400

    # 2) Save uploaded file with a unique name
    filename = secure_filename(video_file.filename)
    unique_name = f"{int(time.time())}_{uuid4().hex}_{filename}"
    saved_path = os.path.join(UPLOAD_DIR, unique_name)

    try:
        video_file.save(saved_path)
    except Exception as e:
        logging.exception("Failed to save uploaded file")
        return jsonify({'error': f'Failed to save uploaded file: {e}'}), 500

    logging.info("Saved uploaded video to: %s", saved_path)

    # 3) Process video into frames
    success = process_video(saved_path, OUTPUT_DIR, num_frames=20)
    if not success:
        return jsonify({'error': 'Failed to process video into frames.'}), 500

    # 4) Call Sightengine for every frame
    all_results = []
    frame_paths = sorted(glob.glob(os.path.join(OUTPUT_DIR, '*.png')))

    if not frame_paths:
        logging.error("No frames produced by ffmpeg.")
        return jsonify({'error': 'No frames produced from video.'}), 500

    for frame_path in frame_paths:
        try:
            with open(frame_path, 'rb') as fh:
                # Send as a file tuple so requests sets filename & content-type correctly
                files = {'media': (os.path.basename(frame_path), fh, 'image/png')}
                r = requests.post('https://api.sightengine.com/1.0/check.json', params=SIGHTENGINE_PARAMS, files=files, timeout=30)
            if r.status_code == 200:
                output = r.json()
                all_results.append({'result': output, 'error': None})
            else:
                logging.error("Sightengine error for %s: %s", frame_path, r.text)
                all_results.append({'result': None, 'error': {'status_code': r.status_code, 'message': r.text}})
        except Exception as e:
            logging.exception("Exception while sending frame to Sightengine")
            all_results.append({'result': None, 'error': {'exception': str(e)}})

    # 5) Save aggregated JSON
    output_file_path = os.path.join(OUTPUT_DIR, "All_Json_Values.json")
    try:
        with open(output_file_path, 'w', encoding='utf-8') as f:
            json.dump(all_results, f, indent=4, ensure_ascii=False)
    except Exception:
        logging.exception("Failed to write aggregated JSON")

    # 6) Compute average of ai_generated values (safe extraction)
    ai_generated_values = []
    for body in all_results:
        try:
            res = body.get('result')
            if isinstance(res, dict):
                ai_generated = res.get('type', {}).get('ai_generated')
                if ai_generated is not None:
                    try:
                        ai_generated_values.append(float(ai_generated))
                    except Exception:
                        logging.warning("ai_generated not numeric: %s", ai_generated)
        except Exception:
            pass

    array_size = len(ai_generated_values)
    sum_values = sum(ai_generated_values) if array_size > 0 else 0.0
    average = (sum_values / array_size) if array_size > 0 else 0.0

    logging.info("Processed %d frames. Average ai_generated: %f", len(frame_paths), average)

    # Optionally keep writing aggregated JSON to disk for debugging, but not required:
    try:
        with open(output_file_path, 'w', encoding='utf-8') as f:
            json.dump(all_results, f, indent=4, ensure_ascii=False)
    except Exception:
        logging.exception("Failed to write aggregated JSON (non-fatal)")

    # *** Return the results directly to the client (no front-end file read required) ***
    return jsonify({
        'average': average,
        'frames_processed': len(frame_paths),
        'results': all_results
    })

if __name__ == '__main__':
    # app.run(host='0.0.0.0', port=5000)  # use this if you want external access
    app.run(debug=True)
