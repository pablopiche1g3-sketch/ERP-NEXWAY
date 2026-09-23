import base64
import io
import os
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import qrcode
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

app = FastAPI(
    title="Microservicio de Generación de PDF DTE - El Salvador",
    description="API para compilar la Representación Gráfica oficial en PDF de los DTEs (Facturas '01' y Créditos Fiscales '03') según normativa del Ministerio de Hacienda.",
    version="1.0.0"
)

# Configuración de CORS para permitir consumo desde la app Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Carga de plantillas Jinja2
TEMPLATE_DIR = os.path.dirname(os.path.abspath(__file__))
jinja_env = Environment(loader=FileSystemLoader(TEMPLATE_DIR), autoescape=True)

# ---------------------------------------------------------------------------
# ESQUEMAS PYDANTIC (Modelos de Entrada)
# ---------------------------------------------------------------------------

class IdentificacionModel(BaseModel):
    ambiente: str = Field(..., description="'00' para pruebas (sandbox), '01' para producción")
    tipoDte: str = Field(..., description="'01' Factura, '03' CCF, '05' Nota de Crédito")
    codigoGeneracion: str = Field(..., description="UUID v4 en mayúsculas")
    numeroControl: str = Field(..., description="Ej: DTE-01-M001P001-000000000000001")
    fecEmi: str = Field(..., description="Fecha de emisión YYYY-MM-DD")
    horEmi: str = Field(..., description="Hora de emisión HH:MM:SS")
    tipoModelo: Optional[int] = 1
    tipoOperacion: Optional[int] = 1

class EmisorModel(BaseModel):
    nit: str
    nrc: str
    nombre: str
    codActividad: str
    descActividad: str
    direccion: str
    telefono: Optional[str] = None
    correo: Optional[str] = None
    nombreComercial: Optional[str] = None
    logoBase64: Optional[str] = Field(None, description="Logo en formato PNG/JPEG base64 sin prefijo data:")

class ReceptorModel(BaseModel):
    tipoDocumento: str = Field(..., description="'13' DUI, '36' NIT, '37' Pasaporte, '03' Otro")
    numDocumento: Optional[str] = None
    nombre: str
    nrc: Optional[str] = None
    direccion: Optional[str] = None
    correo: Optional[str] = None
    codActividad: Optional[str] = None
    descActividad: Optional[str] = None

class CuerpoDocumentoItem(BaseModel):
    numItem: int
    cantidad: float
    descripcion: str
    precioUni: float
    ventaGravada: float
    montoDescu: Optional[float] = 0.0
    uniMedida: Optional[int] = 59
    tipoItem: Optional[int] = 1

class ResumenModel(BaseModel):
    totalGravada: float
    subTotal: float
    totalIva: float = Field(default=0.0, description="IVA 13% desglosado para CCF o informativo")
    ivaRete1: Optional[float] = Field(default=0.0, description="Retención 1% si aplica")
    totalPagar: float
    totalLetras: str
    totalDescu: Optional[float] = 0.0
    condicionOperacion: Optional[int] = 1

class DTEDocumentoPayload(BaseModel):
    identificacion: IdentificacionModel
    emisor: EmisorModel
    receptor: ReceptorModel
    cuerpoDocumento: List[CuerpoDocumentoItem]
    resumen: ResumenModel
    selloRecepcion: Optional[str] = Field(None, description="Sello de recepción otorgado por Hacienda")

# ---------------------------------------------------------------------------
# UTILIDADES: GENERACIÓN DE CÓDIGO QR EN MEMORIA
# ---------------------------------------------------------------------------

def generate_qr_base64(ambiente: str, codigo_generacion: str) -> str:
    """
    Genera el código QR oficial en memoria que apunta a la URL de consulta pública de Hacienda:
    https://factura.mh.gob.sv/consultaPublica?ambiente={ambiente}&codGen={codigoGeneracion}
    """
    url_mh = f"https://factura.mh.gob.sv/consultaPublica?ambiente={ambiente}&codGen={codigo_generacion}"
    
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=6,
        border=1,
    )
    qr.add_data(url_mh)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="#0f172a", back_color="white")
    
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    
    return base64.b64encode(buffer.getvalue()).decode("utf-8")

# ---------------------------------------------------------------------------
# ENDPOINTS
# ---------------------------------------------------------------------------

@app.get("/", tags=["Salud"])
def health_check():
    return {
        "status": "online",
        "service": "DTE El Salvador PDF Generator Microservice",
        "framework": "FastAPI + WeasyPrint",
        "version": "1.0.0"
    }

@app.post("/api/v1/reports/dte-pdf", tags=["Reportes DTE"])
async def generate_dte_pdf(payload: DTEDocumentoPayload):
    """
    Recibe el JSON del DTE, procesa el QR oficial de Hacienda,
    compila la plantilla Jinja2 y devuelve la representación gráfica oficial en PDF.
    """
    try:
        # 1. Generar Código QR en memoria
        qr_base64 = generate_qr_base64(
            ambiente=payload.identificacion.ambiente,
            codigo_generacion=payload.identificacion.codigoGeneracion
        )
        
        # 2. Renderizar plantilla Jinja2
        template = jinja_env.get_template("dte_template.html")
        html_rendered = template.render(
            identificacion=payload.identificacion.model_dump(),
            emisor=payload.emisor.model_dump(),
            receptor=payload.receptor.model_dump(),
            cuerpoDocumento=[item.model_dump() for item in payload.cuerpoDocumento],
            resumen=payload.resumen.model_dump(),
            selloRecepcion=payload.selloRecepcion,
            qrCodeBase64=qr_base64
        )
        
        # 3. Compilar HTML a PDF mediante WeasyPrint
        pdf_bytes = HTML(string=html_rendered, base_url=TEMPLATE_DIR).write_pdf()
        
        # 4. Retornar PDF con headers de visualización inline
        filename = f"DTE-{payload.identificacion.tipoDte}-{payload.identificacion.codigoGeneracion}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"inline; filename={filename}",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al compilar la representación gráfica del DTE: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
