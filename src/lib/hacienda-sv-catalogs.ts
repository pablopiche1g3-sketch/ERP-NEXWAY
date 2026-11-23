// Catálogos Oficiales del Ministerio de Hacienda de El Salvador (Facturación Electrónica DTE)

export interface HaciendaCatalogItem {
  codigo: string;
  descripcion: string;
}

// CAT-012: Departamentos de El Salvador
export const CAT_012_DEPARTAMENTOS: HaciendaCatalogItem[] = [
  { codigo: '01', descripcion: 'Ahuachapán' },
  { codigo: '02', descripcion: 'Santa Ana' },
  { codigo: '03', descripcion: 'Sonsonate' },
  { codigo: '04', descripcion: 'Chalatenango' },
  { codigo: '05', descripcion: 'La Libertad' },
  { codigo: '06', descripcion: 'San Salvador' },
  { codigo: '07', descripcion: 'Cuscatlán' },
  { codigo: '08', descripcion: 'La Paz' },
  { codigo: '09', descripcion: 'Cabañas' },
  { codigo: '10', descripcion: 'San Vicente' },
  { codigo: '11', descripcion: 'Usulután' },
  { codigo: '12', descripcion: 'San Miguel' },
  { codigo: '13', descripcion: 'Morazán' },
  { codigo: '14', descripcion: 'La Unión' }
];

// CAT-013: Municipios de El Salvador (agrupados por código de departamento CAT-012)
export const CAT_013_MUNICIPIOS: Record<string, HaciendaCatalogItem[]> = {
  '01': [
    { codigo: '13', descripcion: 'Ahuachapán Norte' },
    { codigo: '14', descripcion: 'Ahuachapán Centro' },
    { codigo: '15', descripcion: 'Ahuachapán Sur' }
  ],
  '02': [
    { codigo: '14', descripcion: 'Santa Ana Norte' },
    { codigo: '15', descripcion: 'Santa Ana Centro' },
    { codigo: '16', descripcion: 'Santa Ana Este' },
    { codigo: '17', descripcion: 'Santa Ana Oeste' }
  ],
  '03': [
    { codigo: '17', descripcion: 'Sonsonate Norte' },
    { codigo: '18', descripcion: 'Sonsonate Centro' },
    { codigo: '19', descripcion: 'Sonsonate Este' },
    { codigo: '20', descripcion: 'Sonsonate Oeste' }
  ],
  '04': [
    { codigo: '34', descripcion: 'Chalatenango Norte' },
    { codigo: '35', descripcion: 'Chalatenango Centro' },
    { codigo: '36', descripcion: 'Chalatenango Sur' }
  ],
  '05': [
    { codigo: '23', descripcion: 'La Libertad Norte' },
    { codigo: '24', descripcion: 'La Libertad Centro' },
    { codigo: '25', descripcion: 'La Libertad Oeste' },
    { codigo: '26', descripcion: 'La Libertad Este (Antiguo Cuscatlán / Nuevo Cuscatlán)' },
    { codigo: '27', descripcion: 'La Libertad Costa' },
    { codigo: '28', descripcion: 'La Libertad Sur (Santa Tecla)' }
  ],
  '06': [
    { codigo: '20', descripcion: 'San Salvador Norte' },
    { codigo: '21', descripcion: 'San Salvador Oeste (Apopa / Nejapa)' },
    { codigo: '22', descripcion: 'San Salvador Este (Soyapango / Ilopango / San Martín)' },
    { codigo: '23', descripcion: 'San Salvador Centro (San Salvador / Mejicanos / Cuscatancingo / Ayutuxtepeque)' },
    { codigo: '24', descripcion: 'San Salvador Sur (San Marcos / Panchimalco)' }
  ],
  '07': [
    { codigo: '17', descripcion: 'Cuscatlán Norte' },
    { codigo: '18', descripcion: 'Cuscatlán Sur (Cojutepeque)' }
  ],
  '08': [
    { codigo: '23', descripcion: 'La Paz Oeste' },
    { codigo: '24', descripcion: 'La Paz Centro' },
    { codigo: '25', descripcion: 'La Paz Este (Zacatecoluca)' }
  ],
  '09': [
    { codigo: '10', descripcion: 'Cabañas Este (Sensuntepeque)' },
    { codigo: '11', descripcion: 'Cabañas Oeste (Ilobasco)' }
  ],
  '10': [
    { codigo: '14', descripcion: 'San Vicente Norte' },
    { codigo: '15', descripcion: 'San Vicente Sur' }
  ],
  '11': [
    { codigo: '24', descripcion: 'Usulután Norte' },
    { codigo: '25', descripcion: 'Usulután Este' },
    { codigo: '26', descripcion: 'Usulután Oeste' }
  ],
  '12': [
    { codigo: '21', descripcion: 'San Miguel Norte' },
    { codigo: '22', descripcion: 'San Miguel Centro' },
    { codigo: '23', descripcion: 'San Miguel Oeste' }
  ],
  '13': [
    { codigo: '27', descripcion: 'Morazán Norte' },
    { codigo: '28', descripcion: 'Morazán Sur (San Francisco Gotera)' }
  ],
  '14': [
    { codigo: '19', descripcion: 'La Unión Norte' },
    { codigo: '20', descripcion: 'La Unión Sur' }
  ]
};

// CAT-022: Tipo de Documento de Identificación del Receptor
export const CAT_022_TIPO_DOCUMENTO: HaciendaCatalogItem[] = [
  { codigo: '36', descripcion: 'NIT' },
  { codigo: '13', descripcion: 'DUI' },
  { codigo: '37', descripcion: 'Otro' },
  { codigo: '03', descripcion: 'Pasaporte' },
  { codigo: '02', descripcion: 'Carnet de Residente' }
];

// CAT-019: Actividades Económicas (Giros Oficiales del Ministerio de Hacienda de El Salvador)
export const CAT_019_ACTIVIDADES: HaciendaCatalogItem[] = [
  // Ferretería, Pinturas, Construcción y Materiales
  { codigo: '46631', descripcion: 'Venta al por mayor de puertas, ventanas, vitrinas y similares' },
  { codigo: '46632', descripcion: 'Venta al por mayor de artículos de ferretería y pinturerías' },
  { codigo: '46633', descripcion: 'Vidrierías' },
  { codigo: '46634', descripcion: 'Venta al por mayor de maderas' },
  { codigo: '46639', descripcion: 'Venta al por mayor de materiales para la construcción n.c.p.' },
  { codigo: '47521', descripcion: 'Venta al por menor de productos de madera' },
  { codigo: '47522', descripcion: 'Venta al por menor de artículos de ferretería' },
  { codigo: '47523', descripcion: 'Venta al por menor de productos de pinturerías' },
  { codigo: '47524', descripcion: 'Venta al por menor en almacenes de vidrio y espejos' },
  { codigo: '47529', descripcion: 'Venta al por menor de materiales de construcción y artículos conexos' },
  { codigo: '20220', descripcion: 'Fabricación de pinturas, barnices y productos de revestimiento similares' },
  { codigo: '41001', descripcion: 'Construcción de edificios residenciales' },
  { codigo: '41002', descripcion: 'Construcción de edificios no residenciales' },
  { codigo: '42100', descripcion: 'Construcción de carreteras, calles y caminos' },
  { codigo: '42200', descripcion: 'Construcción de proyectos de servicio público' },
  { codigo: '42900', descripcion: 'Construcción de obras de ingeniería civil n.c.p.' },
  { codigo: '43120', descripcion: 'Preparación de terreno' },
  { codigo: '43210', descripcion: 'Instalaciones eléctricas' },
  { codigo: '43220', descripcion: 'Instalación de fontanería, calefacción y aire acondicionado' },
  { codigo: '43290', descripcion: 'Otras instalaciones para obras de construcción' },
  { codigo: '43300', descripcion: 'Terminación y acabado de edificios' },
  { codigo: '43900', descripcion: 'Otras actividades especializadas de construcción' },

  // Vehículos, Talleres y Repuestos
  { codigo: '45100', descripcion: 'Venta de vehículos automotores' },
  { codigo: '45201', descripcion: 'Reparación mecánica de vehículos automotores' },
  { codigo: '45202', descripcion: 'Reparaciones eléctricas del automotor y recarga de baterías' },
  { codigo: '45203', descripcion: 'Enderezado y pintura de vehículos automotores' },
  { codigo: '45204', descripcion: 'Reparaciones de radiadores, escapes y silenciadores' },
  { codigo: '45205', descripcion: 'Reparación y reconstrucción de vías, stop y otros artículos de fibra de vidrio' },
  { codigo: '45206', descripcion: 'Reparación de llantas de vehículos automotores' },
  { codigo: '45207', descripcion: 'Polarizado de vehículos (mediante la adhesión de papel especial a los vidrios)' },
  { codigo: '45208', descripcion: 'Lavado y pasteado de vehículos (carwash)' },
  { codigo: '45209', descripcion: 'Reparaciones de vehículos n.c.p.' },
  { codigo: '45301', descripcion: 'Venta de partes, piezas y accesorios nuevos para vehículos automotores' },
  { codigo: '45302', descripcion: 'Venta de partes, piezas y accesorios usados para vehículos automotores' },
  { codigo: '45401', descripcion: 'Venta de motocicletas' },
  { codigo: '45402', descripcion: 'Venta de repuestos, piezas y accesorios de motocicletas' },
  { codigo: '45403', descripcion: 'Mantenimiento y reparación de motocicletas' },

  // Industria, Carpintería, Metalmecánica y Manufactura
  { codigo: '16100', descripcion: 'Aserradero y acepilladura de madera' },
  { codigo: '16220', descripcion: 'Fabricación de partes y piezas de carpintería para edificios y construcciones' },
  { codigo: '25111', descripcion: 'Fabricación de productos metálicos para uso estructural' },
  { codigo: '25920', descripcion: 'Tratamiento y revestimiento de metales' },
  { codigo: '31001', descripcion: 'Fabricación de colchones y somier' },
  { codigo: '31002', descripcion: 'Fabricación de muebles y otros productos de madera a medida' },
  { codigo: '31008', descripcion: 'Servicios de maquilado de muebles' },
  { codigo: '31009', descripcion: 'Fabricación de muebles n.c.p.' },
  { codigo: '13921', descripcion: 'Fabricación de productos textiles para el hogar' },
  { codigo: '14101', descripcion: 'Fabricación de ropa interior y de dormir' },
  { codigo: '14109', descripcion: 'Fabricación de prendas de vestir n.c.p.' },
  { codigo: '18110', descripcion: 'Impresión (imprentas y artes gráficas)' },
  { codigo: '22201', descripcion: 'Fabricación de envases plásticos' },
  { codigo: '23950', descripcion: 'Fabricación de artículos de hormigón, cemento y yeso' },

  // Comercio Mayorista y Minorista General
  { codigo: '46201', descripcion: 'Venta al por mayor de materias primas agrícolas' },
  { codigo: '46301', descripcion: 'Venta al por mayor de alimentos' },
  { codigo: '46302', descripcion: 'Venta al por mayor de bebidas' },
  { codigo: '46411', descripcion: 'Venta al por mayor de hilados, tejidos y productos textiles de mercería' },
  { codigo: '46414', descripcion: 'Venta al por mayor de prendas de vestir y accesorios de vestir' },
  { codigo: '46491', descripcion: 'Venta al por mayor de productos medicinales, cosméticos, perfumería y productos de limpieza' },
  { codigo: '46494', descripcion: 'Venta al por mayor de artículos de bazar y similares' },
  { codigo: '46497', descripcion: 'Venta al por mayor de artículos de papel y cartón (librerías)' },
  { codigo: '46510', descripcion: 'Venta al por mayor de computadoras, equipo periférico y programas informáticos' },
  { codigo: '46590', descripcion: 'Venta de equipos e instrumentos de uso profesional y científico y aparatos de medida y control' },
  { codigo: '46599', descripcion: 'Venta al por mayor de maquinaria y equipo agropecuario, accesorios, partes y suministros' },
  { codigo: '46610', descripcion: 'Venta al por mayor de otros productos combustibles sólidos, líquidos, gaseosos y conexos' },
  { codigo: '46691', descripcion: 'Venta al por mayor de sal industrial sin yodar' },
  { codigo: '46692', descripcion: 'Venta al por mayor de productos intermedios y desechos de origen textil' },
  { codigo: '46695', descripcion: 'Venta al por mayor de fertilizantes, abonos, agroquímicos y productos similares' },
  { codigo: '46699', descripcion: 'Venta al por mayor de productos intermedios y desechos n.c.p.' },
  { codigo: '46900', descripcion: 'Venta al por mayor de otros productos' },
  { codigo: '47111', descripcion: 'Venta en supermercados' },
  { codigo: '47112', descripcion: 'Venta en tiendas de artículos de primera necesidad' },
  { codigo: '47190', descripcion: 'Venta al por menor de otros productos en comercios no especializados' },
  { codigo: '47210', descripcion: 'Venta al por menor de alimentos en comercios especializados' },
  { codigo: '47300', descripcion: 'Venta de combustibles, lubricantes y otros (gasolineras)' },
  { codigo: '47411', descripcion: 'Venta al por menor de computadoras y equipo periférico' },
  { codigo: '47510', descripcion: 'Venta al por menor de hilados, tejidos y productos textiles de mercería' },
  { codigo: '47591', descripcion: 'Venta al por menor de muebles' },
  { codigo: '47592', descripcion: 'Venta al por menor de artículos de bazar' },
  { codigo: '47593', descripcion: 'Venta al por menor de aparatos electrodomésticos, repuestos y accesorios' },
  { codigo: '47610', descripcion: 'Venta al por menor de libros, periódicos y artículos de papelería en comercios especializados' },
  { codigo: '47711', descripcion: 'Venta al por menor de prendas de vestir y accesorios de vestir' },
  { codigo: '47721', descripcion: 'Venta al por menor de medicamentos farmacéuticos y otros materiales y artículos de uso médico (Farmacias)' },
  { codigo: '47739', descripcion: 'Venta al por menor de otros productos n.c.p.' },

  // Transporte y Logística
  { codigo: '49211', descripcion: 'Transporte de pasajeros urbanos e interurbano mediante buses' },
  { codigo: '49231', descripcion: 'Transporte de carga urbano' },
  { codigo: '49232', descripcion: 'Transporte nacional de carga' },
  { codigo: '49233', descripcion: 'Transporte de carga internacional' },
  { codigo: '52101', descripcion: 'Alquiler de instalaciones de almacenamiento en zonas francas' },
  { codigo: '52109', descripcion: 'Alquiler de bodegas para almacenamiento y depósito n.c.p.' },
  { codigo: '52290', descripcion: 'Servicios para el transporte n.c.p. (agencias aduanales y logística)' },

  // Restaurantes, Hoteles y Alimentos
  { codigo: '55101', descripcion: 'Actividades de alojamiento para estancias cortas (Hoteles)' },
  { codigo: '56101', descripcion: 'Restaurantes' },
  { codigo: '56106', descripcion: 'Pupusería' },
  { codigo: '56107', descripcion: 'Actividades varias de restaurantes' },
  { codigo: '56108', descripcion: 'Comedores' },
  { codigo: '56210', descripcion: 'Preparación de comida para eventos especiales (Catering)' },

  // Servicios Profesionales, Tecnología, Salud, Educación y Otros
  { codigo: '62010', descripcion: 'Programación informática' },
  { codigo: '62020', descripcion: 'Consultorías y gestión de servicios informáticos' },
  { codigo: '68101', descripcion: 'Servicio de alquiler y venta de lotes en cementerios' },
  { codigo: '68109', descripcion: 'Actividades inmobiliarias realizadas con bienes propios o arrendados n.c.p.' },
  { codigo: '69100', descripcion: 'Actividades jurídicas (Abogados y Notarios)' },
  { codigo: '69200', descripcion: 'Actividades de contabilidad, teneduría de libros y auditoría; asesoramiento en materia de impuestos' },
  { codigo: '70200', descripcion: 'Actividades de consultoría en gestión empresarial' },
  { codigo: '71101', descripcion: 'Servicios de arquitectura y planificación urbana y servicios conexos' },
  { codigo: '71102', descripcion: 'Servicios de ingeniería' },
  { codigo: '73100', descripcion: 'Publicidad' },
  { codigo: '74100', descripcion: 'Actividades de diseño especializado' },
  { codigo: '77101', descripcion: 'Alquiler de equipo de transporte terrestre' },
  { codigo: '77300', descripcion: 'Alquiler de equipo de transporte por vía acuática y maquinaria' },
  { codigo: '80100', descripcion: 'Servicios de seguridad privados' },
  { codigo: '81210', descripcion: 'Limpieza general de edificios' },
  { codigo: '82990', descripcion: 'Actividades de apoyo empresariales n.c.p.' },
  { codigo: '84110', descripcion: 'Actividades de la Administración Pública en general (Gobierno / Alcaldías)' },
  { codigo: '85102', descripcion: 'Enseñanza primaria y secundaria (Colegios / Escuelas)' },
  { codigo: '85301', descripcion: 'Enseñanza superior universitaria' },
  { codigo: '86100', descripcion: 'Actividades de hospitales' },
  { codigo: '86201', descripcion: 'Clínicas médicas' },
  { codigo: '86202', descripcion: 'Servicios de Odontología' },
  { codigo: '86901', descripcion: 'Servicios de análisis y estudios de diagnóstico (Laboratorios clínicos)' },
  { codigo: '94910', descripcion: 'Actividades de organizaciones religiosas' },
  { codigo: '94990', descripcion: 'Actividades de asociaciones n.c.p. (ONGs / Fundaciones)' },
  { codigo: '96092', descripcion: 'Servicios n.c.p.' },
  { codigo: '10005', descripcion: 'Otros (Consumidor Final / Sin actividad económica registrada)' }
];

export function findDepartmentCode(deptNameOrCode?: string): string {
  if (!deptNameOrCode) return '06';
  const clean = deptNameOrCode.trim().toLowerCase();
  const byCode = CAT_012_DEPARTAMENTOS.find((d) => d.codigo === clean);
  if (byCode) return byCode.codigo;
  const byName = CAT_012_DEPARTAMENTOS.find((d) => d.descripcion.toLowerCase() === clean);
  return byName ? byName.codigo : '06';
}

export function findMunicipalityList(deptCode: string): HaciendaCatalogItem[] {
  return CAT_013_MUNICIPIOS[deptCode] || CAT_013_MUNICIPIOS['06'];
}

export function validateContribuyenteMH(customer: {
  category?: string;
  nit?: string;
  nrc?: string;
  giro?: string;
  cod_actividad?: string;
  email?: string;
  address?: string;
  department?: string;
  department_code?: string;
  municipality?: string;
  municipality_code?: string;
}): { isCcf: boolean; isReady: boolean; missing: string[] } {
  const isCcf = customer.category === 'Crédito Fiscal' || Boolean(customer.nrc);
  if (!isCcf) return { isCcf: false, isReady: true, missing: [] };

  const missing: string[] = [];
  if (!customer.nit?.trim()) missing.push('NIT');
  if (!customer.nrc?.trim()) missing.push('NRC');
  if (!customer.giro?.trim() && !customer.cod_actividad?.trim()) missing.push('Giro (CAT-019)');
  if (!customer.department?.trim() && !customer.department_code?.trim()) missing.push('Departamento');
  if (!customer.municipality?.trim() && !customer.municipality_code?.trim()) missing.push('Municipio');
  if (!customer.address?.trim()) missing.push('Dirección');
  if (!customer.email?.trim()) missing.push('Correo DTE');

  return {
    isCcf: true,
    isReady: missing.length === 0,
    missing
  };
}

/**
 * Retención 1% IVA El Salvador:
 * Aplica cuando el cliente es Gran Contribuyente, se emite CCF (03) y el subtotal gravado >= $100.00.
 */
export function calculateIvaRetention1Percent(
  subtotalGravado: number,
  isGranContribuyente?: boolean,
  docType?: string
): number {
  if (!isGranContribuyente || docType !== 'CCF') return 0;
  if (subtotalGravado < 100) return 0;
  return Number((subtotalGravado * 0.01).toFixed(2));
}
