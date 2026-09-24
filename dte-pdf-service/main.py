import base64
import io
import os
from typing import List, Optional, Any, Dict
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import qrcode
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

app = FastAPI(
    title="Microservicio de Generación de Reportes PDF - ERP NEXWAY",
    description="API para compilar DTEs, Cotizaciones Comerciales y Quedan en PDF de alta calidad con WeasyPrint.",
    version="1.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMPLATE_DIR = os.path.dirname(os.path.abspath(__file__))
jinja_env = Environment(loader=FileSystemLoader(TEMPLATE_DIR), autoescape=True)

# Modelos DTE
class IdentificacionModel(BaseModel):
    ambiente: str
    tipoDte: str
    codigoGeneracion: str
    numeroControl: str
    fecEmi: str
    horEmi: str

class EmisorModel(BaseModel):
    nit: str
    nrc: str
    nombre: str
    codActividad: str
    descActividad: str
    direccion: str
    telefono: Optional[str] = None
    logoBase64: Optional[str] = None

class ReceptorModel(BaseModel):
    tipoDocumento: str
    numDocumento: Optional[str] = None
    nombre: str
    nrc: Optional[str] = None
    direccion: Optional[str] = None

class CuerpoDocumentoItem(BaseModel):
    numItem: int
    cantidad: float
    descripcion: str
    precioUni: float
    ventaGravada: float
    montoDescu: Optional[float] = 0.0

class ResumenModel(BaseModel):
    totalGravada: float
    subTotal: float
    totalIva: float = 0.0
    ivaRete1: Optional[float] = 0.0
    totalPagar: float
    totalLetras: str

class DTEDocumentoPayload(BaseModel):
    identificacion: IdentificacionModel
    emisor: EmisorModel
    receptor: ReceptorModel
    cuerpoDocumento: List[CuerpoDocumentoItem]
    resumen: ResumenModel
    selloRecepcion: Optional[str] = None

# Modelos Cotización
class CotizacionPayload(BaseModel):
    numeroCotizacion: str
    fechaEmision: str
    validezDias: Optional[int] = 15
    formaPago: Optional[str] = "CONTADO"
    emisor: EmisorModel
    cliente: Dict[str, Any]
    items: List[Dict[str, Any]]
    subtotal: float
    iva: Optional[float] = 0.0
    total: float
    observaciones: Optional[str] = None

# Modelos Quedan
class QuedanPayload(BaseModel):
    numeroQuedan: str
    fechaRecepcion: str
    fechaPago: str
    emisor: EmisorModel
    proveedor: Dict[str, Any]
    facturas: List[Dict[str, Any]]
    totalFacturas: float
    retencion1: Optional[float] = 0.0
    totalPagar: float
    observaciones: Optional[str] = None

def generate_qr_base64(ambiente: str, codigo_generacion: str) -> str:
    url_mh = f"https://factura.mh.gob.sv/consultaPublica?ambiente={ambiente}&codGen={codigo_generacion}"
    qr = qrcode.QRCode(version=1, box_size=6, border=1)
    qr.add_data(url_mh)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0f172a", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")

@app.get("/", tags=["Salud"])
def health():
    return {"status": "online", "service": "ERP NEXWAY PDF Microservice", "version": "1.1.0"}

@app.post("/api/v1/reports/dte-pdf", tags=["Reportes"])
async def generate_dte_pdf(payload: DTEDocumentoPayload):
    try:
        qr_base64 = generate_qr_base64(payload.identificacion.ambiente, payload.identificacion.codigoGeneracion)
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
        pdf_bytes = HTML(string=html_rendered, base_url=TEMPLATE_DIR).write_pdf()
        filename = f"DTE-{payload.identificacion.tipoDte}-{payload.identificacion.codigoGeneracion}.pdf"
        return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"inline; filename={filename}"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/reports/cotizacion-pdf", tags=["Reportes"])
async def generate_cotizacion_pdf(payload: CotizacionPayload):
    try:
        template = jinja_env.get_template("cotizacion_template.html")
        html_rendered = template.render(**payload.model_dump())
        pdf_bytes = HTML(string=html_rendered, base_url=TEMPLATE_DIR).write_pdf()
        filename = f"Cotizacion-{payload.numeroCotizacion}.pdf"
        return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"inline; filename={filename}"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/reports/quedan-pdf", tags=["Reportes"])
async def generate_quedan_pdf(payload: QuedanPayload):
    try:
        template = jinja_env.get_template("quedan_template.html")
        html_rendered = template.render(**payload.model_dump())
        pdf_bytes = HTML(string=html_rendered, base_url=TEMPLATE_DIR).write_pdf()
        filename = f"Quedan-{payload.numeroQuedan}.pdf"
        return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"inline; filename={filename}"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
