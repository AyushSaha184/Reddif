import os
from PIL import Image, ImageChops

def main():
    img_path = r"C:\Users\Ayush\.gemini\antigravity\brain\1cd9642c-dd8a-4484-ac8f-445a550c9b90\media__1776442958554.jpg"
    
    if not os.path.exists(img_path):
        print(f"Error: {img_path} not found.")
        return

    try:
        img = Image.open(img_path)
        img = img.convert("RGBA")
        
        # Remove white background
        data = img.getdata()
        new_data = []
        for item in data:
            # White tolerance
            if item[0] > 240 and item[1] > 240 and item[2] > 240:
                new_data.append((255, 255, 255, 0)) # transparent
            else:
                new_data.append(item)
        img.putdata(new_data)
        
        # Crop tight to non-transparent area
        bbox = img.getbbox()
        if bbox:
            # Add a small padding
            padding = int(min(img.width, img.height) * 0.05)
            # Left, Upper, Right, Lower
            new_bbox = (
                max(0, bbox[0] - padding),
                max(0, bbox[1] - padding),
                min(img.width, bbox[2] + padding),
                min(img.height, bbox[3] + padding)
            )
            img = img.crop(new_bbox)
            
        sizes = {
            "mdpi": 48,
            "hdpi": 72,
            "xhdpi": 96,
            "xxhdpi": 144,
            "xxxhdpi": 192
        }
        
        base_path = r"c:\vscode\Projects\Reddif\mobile\android\app\src\main\res"
        
        for folder, size in sizes.items():
            dir_path = os.path.join(base_path, f"drawable-{folder}")
            os.makedirs(dir_path, exist_ok=True)
            
            resized = img.resize((size, size), Image.Resampling.LANCZOS)
            
            out_path1 = os.path.join(dir_path, "ic_launcher.png")
            out_path2 = os.path.join(dir_path, "ic_launcher_round.png")
            
            resized.save(out_path1, "PNG")
            resized.save(out_path2, "PNG")
            
            print(f"Saved: {out_path1}")
            
        print("Logo correctly converted and exported.")
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    main()
