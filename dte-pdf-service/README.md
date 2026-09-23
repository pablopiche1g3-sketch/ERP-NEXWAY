# Microservicio de Generación de Reportes PDF para DTE (El Salvador)

Microservicio backend independiente en Python con **FastAPI** y **WeasyPrint** para renderizar la Representación Gráfica oficial en PDF de los Documentos Tributarios Electrónicos (DTE-01 Factura y DTE-03 Crédito Fiscal) según los lineamientos del Ministerio de Hacienda de El Salvador.

## 🚀 Requisitos e Instalación

### Opción A: Ejecución con Python Virtual Environment

`ash
# 1. Crear y activar entorno virtual
python -m venv venv
# En Windows:
.\venv\Scripts\activate
# En Linux/macOS:
source venv/bin/activate

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Iniciar el servidor
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
`

> **Nota para WeasyPrint en Windows/Linux**: WeasyPrint requiere las librerías nativas cairo, pango y gdk-pixbuf. En Linux se instalan con sudo apt-get install libpango-1.0-0 libharfbuzz0b libpangoft2-1.0-0 libffi-dev libcairo2. En Windows se instalan vía GTK3 o ejecutando en contenedor Docker.

---

## 📡 Endpoint Principal

### POST /api/v1/reports/dte-pdf
- **Body**: JSON conforme al modelo DTEDocumentoPayload.
- **Respuesta**: Archivo binario pplication/pdf con visualización inline en el navegador.

