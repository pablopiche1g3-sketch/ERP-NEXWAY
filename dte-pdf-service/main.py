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
    description="API para compilar DTEs, Cotizaciones Comerciales, Quedan y Plantillas Personalizadas en PDF de alta calidad con WeasyPrint.",
    version="1.2.0"
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
    sku: Optional[str] = None

class ResumenModel(BaseModel):
    totalGravada: float
    subTotal: float
    totalIva: float = 0.0
    ivaRete1: Optional[float] = 0.0
    totalDescu: Optional[float] = 0.0
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

# Modelo para Diseñador de Plantillas Personalizadas (Tickets & A4)
class CustomTemplatePayload(BaseModel):
    template_name: Optional[str] = "Ticket Térmico POS"
    paper_size: Optional[str] = "80mm"  # "80mm", "58mm", "A4"
    blocks: List[Dict[str, Any]] = []
    emisor: Optional[Dict[str, Any]] = None
    receptor: Optional[Dict[str, Any]] = None
    identificacion: Optional[Dict[str, Any]] = None
    items: Optional[List[Dict[str, Any]]] = []
    resumen: Optional[Dict[str, Any]] = None
    selloRecepcion: Optional[str] = None

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
@app.get("/api/v1/health", tags=["Salud"])
def health():
    return {
        "status": "online",
        "service": "ERP NEXWAY PDF Microservice",
        "version": "1.2.0",
        "engine": "WeasyPrint + Jinja2 + QRCode"
    }

@app.post("/api/v1/reports/custom-template-pdf", tags=["Reportes"])
async def generate_custom_template_pdf(payload: CustomTemplatePayload):
    try:
        ambiente = payload.identificacion.get("ambiente", "00") if payload.identificacion else "00"
        cod_gen = payload.identificacion.get("codigoGeneracion", "DTE-TEST-12345") if payload.identificacion else "DTE-TEST-12345"
        qr_base64 = generate_qr_base64(ambiente, cod_gen)

        template = jinja_env.get_template("custom_ticket_template.html")
        html_rendered = template.render(
            template_name=payload.template_name,
            paper_size=payload.paper_size,
            blocks=payload.blocks,
            emisor=payload.emisor or {
                "nombre": "NEXWAY ERP S.A. DE C.V.",
                "nit": "0614-150890-102-1",
                "nrc": "283940-1",
                "direccion": "San Salvador, El Salvador",
                "telefono": "+503 2200-0000"
            },
            receptor=payload.receptor or {
                "nombre": "CLIENTE GENERAL / CONSUMIDOR FINAL",
                "numDocumento": "0614-010190-001-0",
                "nrc": "N/A",
                "direccion": "San Salvador"
            },
            identificacion=payload.identificacion or {
                "fecEmi": "2026-09-25",
                "horEmi": "13:50:00",
                "tipoDteNombre": "FACTURA DE CONSUMIDOR FINAL (DTE-01)",
                "codigoGeneracion": cod_gen,
                "numeroControl": "DTE-01-C001-0000001892"
            },
            items=payload.items or [
                {"cantidad": 2, "descripcion": "Cemento Portland 42.5kg", "precioUni": 10.50, "ventaGravada": 21.00, "sku": "CEM-001"},
                {"cantidad": 1, "descripcion": "Pintura Acrílica Blanco 1 Gal", "precioUni": 18.00, "ventaGravada": 18.00, "sku": "PIN-002"}
            ],
            resumen=payload.resumen or {
                "subTotal": 34.51,
                "totalIva": 4.49,
                "totalPagar": 39.00,
                "totalLetras": "TREINTA Y NUEVE 00/100 USD"
            },
            selloRecepcion=payload.selloRecepcion or "2026-SELLO-MH-8492019483019",
            qrCodeBase64=qr_base64
        )

        pdf_bytes = HTML(string=html_rendered, base_url=TEMPLATE_DIR).write_pdf()
        filename = f"{payload.template_name.replace(' ', '_')}.pdf"
        return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"inline; filename={filename}"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
