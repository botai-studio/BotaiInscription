
import os

file_path = r'c:\Users\Owner\Desktop\Botai\src\components\UI\ControlPanel.jsx'

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Attempt to fix mojibake:
    # The file currently contains characters that result from interpreting UTF-8 bytes as Windows-1252.
    # So we reverse it: encode to Windows-1252 to get the bytes, then decode as UTF-8.
    
    fixed_content = content.encode('cp1252').decode('utf-8')
    
    print("Successfully decoded content.")
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(fixed_content)
        
    print(f"Fixed encoding for {file_path}")

except UnicodeEncodeError as e:
    print(f"Error during encoding (some characters might not map to cp1252): {e}")
except UnicodeDecodeError as e:
    print(f"Error during decoding (bytes might not be valid utf-8): {e}")
except Exception as e:
    print(f"An error occurred: {e}")
