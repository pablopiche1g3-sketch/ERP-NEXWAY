import { test, expect } from '@playwright/test';

test.describe('NEXWAY ERP - Day in the Life', () => {
  test('Flujo completo de cotización a facturación (con Login local)', async ({ page }) => {
    test.setTimeout(90000); // 90s timeout
    
    const baseUrl = 'http://localhost:9002';

    // 1. Navegar a la página y loguearse
    await page.goto(`${baseUrl}/login`);
    
    // Llenar credenciales
    await page.fill('input[type="email"]', 'pablopiche1g3@gmail.com');
    await page.fill('input[type="password"]', 'policia99');
    await page.click('button:has-text("Entrar al Sistema")');

    // Esperar a que el login termine y redirija al dashboard
    await expect(page.locator('text=Panel Principal')).toBeVisible({ timeout: 20000 });

    // 2. Navegar a Cotizaciones
    await page.goto(`${baseUrl}/quotations`);
    
    // Esperar a que la página cargue
    await page.waitForSelector('text=Producto Fuera de Catálogo', { timeout: 15000 });

    // Agregar un producto personalizado en lugar de depender del inventario
    await page.fill('input[placeholder="Ej. Abrazadera especial 1/2 pulgada..."]', 'Motor Eléctrico de Prueba E2E');
    await page.fill('input[placeholder="Ej. TEMP-8839 (Opcional)"]', 'SKU-TEST-001');
    await page.fill('input[placeholder="0.00"]', '150.50');
    
    // Clic en agregar producto personalizado
    await page.click('button:has-text("Agregar")');

    // Llenar datos de cliente
    await page.fill('input[placeholder="Nombre completo o Empresa..."]', 'Empresa Prueba SA de CV');
    
    // Generar cotización
    await page.click('button:has-text("Guardar e Imprimir")');

    // Esperar mensaje de éxito
    await expect(page.locator('text=Documento Guardado')).toBeVisible({ timeout: 15000 });

    // 3. Navegar a Facturación
    await page.goto(`${baseUrl}/billing`);

    // Clic en Importar Cotización
    await page.click('button:has-text("Importar Cotización")');

    // Seleccionar la cotización de la lista
    await page.waitForSelector('text=Empresa Prueba SA de CV', { timeout: 15000 });
    await page.click('text=Empresa Prueba SA de CV');

    // Finalizar Venta
    await page.click('button:has-text("FINALIZAR Y NOTIFICAR")');

    // Confirmar Venta
    await page.click('button:has-text("Confirmar Venta")');

    // Verificar Éxito
    await expect(page.locator('text=Venta Exitosa')).toBeVisible({ timeout: 15000 });
  });
});
