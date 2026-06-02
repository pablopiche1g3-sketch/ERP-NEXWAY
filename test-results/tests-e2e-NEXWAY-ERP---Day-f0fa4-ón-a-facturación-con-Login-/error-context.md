# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\e2e.spec.ts >> NEXWAY ERP - Day in the Life >> Flujo completo de cotización a facturación (con Login)
- Location: tests\e2e.spec.ts:4:7

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: page.fill: Test timeout of 90000ms exceeded.
Call log:
  - waiting for locator('input[type="email"]')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - img [ref=e7]
      - generic [ref=e10]:
        - heading "NexWay ERP" [level=1] [ref=e11]
        - paragraph [ref=e12]: Acceso al Sistema
    - generic [ref=e13]:
      - generic [ref=e14]:
        - img [ref=e15]
        - generic [ref=e17]:
          - paragraph [ref=e18]: "Acceso Rápido:"
          - paragraph [ref=e19]:
            - text: "Usuario:"
            - strong [ref=e20]: admin
          - paragraph [ref=e21]:
            - text: "Clave:"
            - strong [ref=e22]: "12345"
          - button "Completar ahora" [ref=e23] [cursor=pointer]
      - generic [ref=e24]:
        - generic [ref=e25]:
          - text: Nombre de Usuario
          - generic [ref=e26]:
            - img [ref=e27]
            - textbox "ej. admin" [ref=e30]
        - generic [ref=e31]:
          - text: Contraseña
          - textbox "Contraseña" [ref=e32]:
            - /placeholder: •••••
        - button "Entrar al Sistema" [ref=e33] [cursor=pointer]
  - region "Notifications (F8)":
    - list
  - alert [ref=e34]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('NEXWAY ERP - Day in the Life', () => {
  4  |   test('Flujo completo de cotización a facturación (con Login)', async ({ page }) => {
  5  |     test.setTimeout(90000); // 90s timeout for safety, given remote connection
  6  |     
  7  |     const baseUrl = 'https://studio--studio-8389574161-3faaf.us-central1.hosted.app';
  8  | 
  9  |     // 1. Navegar a la página y loguearse
  10 |     await page.goto(`${baseUrl}/login`);
  11 |     
  12 |     // Llenar credenciales
> 13 |     await page.fill('input[type="email"]', 'pablopiche1g3@gmail.com');
     |                ^ Error: page.fill: Test timeout of 90000ms exceeded.
  14 |     await page.fill('input[type="password"]', 'policia99');
  15 |     await page.click('button:has-text("Ingresar")');
  16 | 
  17 |     // Esperar a que el login termine y redirija al dashboard
  18 |     await expect(page.locator('text=Panel Principal')).toBeVisible({ timeout: 20000 });
  19 | 
  20 |     // 2. Navegar a Cotizaciones
  21 |     await page.goto(`${baseUrl}/quotations`);
  22 |     
  23 |     // Esperar a que la página cargue
  24 |     await page.waitForSelector('text=Producto Fuera de Catálogo', { timeout: 15000 });
  25 | 
  26 |     // Agregar un producto personalizado en lugar de depender del inventario
  27 |     await page.fill('input[placeholder="Ej. Abrazadera especial 1/2 pulgada..."]', 'Motor Eléctrico de Prueba E2E');
  28 |     await page.fill('input[placeholder="Ej. TEMP-8839 (Opcional)"]', 'SKU-TEST-001');
  29 |     await page.fill('input[placeholder="0.00"]', '150.50');
  30 |     
  31 |     // Clic en agregar producto personalizado
  32 |     await page.click('button:has-text("Agregar")');
  33 | 
  34 |     // Llenar datos de cliente
  35 |     await page.fill('input[placeholder="Nombre completo o Empresa..."]', 'Empresa Prueba SA de CV');
  36 |     
  37 |     // Generar cotización
  38 |     await page.click('button:has-text("Guardar e Imprimir")');
  39 | 
  40 |     // Esperar mensaje de éxito
  41 |     await expect(page.locator('text=Documento Guardado')).toBeVisible({ timeout: 15000 });
  42 | 
  43 |     // 3. Navegar a Facturación
  44 |     await page.goto(`${baseUrl}/billing`);
  45 | 
  46 |     // Clic en Importar Cotización
  47 |     await page.click('button:has-text("Importar Cotización")');
  48 | 
  49 |     // Seleccionar la cotización de la lista
  50 |     await page.waitForSelector('text=Empresa Prueba SA de CV', { timeout: 15000 });
  51 |     await page.click('text=Empresa Prueba SA de CV');
  52 | 
  53 |     // Finalizar Venta
  54 |     await page.click('button:has-text("FINALIZAR Y NOTIFICAR")');
  55 | 
  56 |     // Confirmar Venta
  57 |     await page.click('button:has-text("Confirmar Venta")');
  58 | 
  59 |     // Verificar Éxito
  60 |     await expect(page.locator('text=Venta Exitosa')).toBeVisible({ timeout: 15000 });
  61 |   });
  62 | });
  63 | 
```