import urllib.request
import sys

url = "https://www.itconsultinglatam.com/wp-content/uploads/2011/12/Manual-de-Proyectos-Web.pdf"
output_path = "c:\\Users\\TECNICOLOR OFICINA\\Desktop\\Nueva carpeta\\ERP-NEXWAY\\docs\\Manual-de-Proyectos-Web.pdf"

print(f"Downloading from {url}...")
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        with open(output_path, 'wb') as out_file:
            out_file.write(response.read())
    print("Download successful!")
except Exception as e:
    print(f"Error occurred: {e}")
    sys.exit(1)
