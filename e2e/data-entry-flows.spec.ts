import { test, expect } from '@playwright/test';

test.describe('Carga Interactiva de Datos y Cálculos en Tiempo Real', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('credit_on_e2e_session', 'admin');
    });
    await page.goto('/');
    await expect(page.getByText('Patrimonio Neto Operativo Valuado')).toBeVisible();
  });

  test('Alta de Operación: Carga de cliente y recálculo reactivo de cuotas y liquidación', async ({ page }) => {
    // Navegar a Alta de Operaciones
    await page.getByRole('button', { name: 'Alta de Operaciones', exact: true }).click();
    await expect(page.getByText('Alta de Operaciones y Cronograma')).toBeVisible();

    // Rellenar datos del cliente
    const nombreInput = page.getByPlaceholder(/Ej. Juan Carlos Pérez/i);
    await nombreInput.fill('JUAN ALBERTO CARRIZO');

    const dniInput = page.getByPlaceholder(/Ej. 28.491.203/i);
    await dniInput.fill('31.984.502');

    const telInput = page.getByPlaceholder(/Ej. \+54 385 512-3490/i);
    await telInput.fill('+54 385 411-9988');

    // Cambiar capital a 50k con botón rápido
    const btn50k = page.getByRole('button', { name: '50k', exact: true });
    await expect(btn50k).toBeVisible();
    await btn50k.click();

    // En plan 26 días (30% recargo), $50.000 capital = $65.000 total y $2.500 / día
    await expect(page.getByText(/\$2\.500 \/ día/i).first()).toBeVisible();
    await expect(page.getByText(/Total Liquidación: ARS \$65\.000/i).first()).toBeVisible();

    // Cambiar capital a 100k con botón rápido
    const btn100k = page.getByRole('button', { name: '100k', exact: true });
    await btn100k.click();

    // $100.000 capital = $130.000 total y $5.000 / día
    await expect(page.getByText(/\$5\.000 \/ día/i).first()).toBeVisible();
    await expect(page.getByText(/Total Liquidación: ARS \$130\.000/i).first()).toBeVisible();

    // Verificar que la tabla de cuotas haya generado 26 filas programadas
    await expect(page.getByText(/26 Cuotas Generadas/i)).toBeVisible();
  });

  test('Gestión de Stock: Búsqueda interactiva y rastreo de IMEI/Serie', async ({ page }) => {
    await page.getByRole('button', { name: 'Stock y Recuperación', exact: true }).click();

    // Abrir modal de Escaneo
    await page.getByRole('button', { name: /Escanear IMEI \/ Serie/i }).click();
    await expect(page.getByText(/Centro de Escaneo & Trazabilidad de Series/i)).toBeVisible();

    const imeiInput = page.getByPlaceholder(/Apuntá con la pistola lectora o escribí el IMEI/i);
    await imeiInput.fill('NBX-43FHD');

    // Comprobar que detecte la serie y muestre el estado de stock
    await expect(page.getByText(/NBX-43FHD-994103/i).first()).toBeVisible();

    // Probar búsqueda con otra serie
    await imeiInput.fill('GAF-SERIE');
    await expect(page.getByText(/GAF-SERIE-8812/i).first()).toBeVisible();

    // Cerrar modal
    await page.getByRole('button', { name: 'Cerrar', exact: true }).last().click();
    await expect(page.getByText(/Centro de Escaneo & Trazabilidad de Series/i)).not.toBeVisible();
  });

  test('Arqueo y Cierre de Caja: Selección de cobrador y ajuste de efectivo rendido', async ({ page }) => {
    await page.getByRole('button', { name: 'Cierre de Caja y Arqueo', exact: true }).click();
    await expect(page.getByText(/Cierre de Caja y Arqueo Diario/i)).toBeVisible();

    // Cambiar a modo "Monto Directo"
    const montoDirectoBtn = page.getByRole('button', { name: /Monto Directo/i });
    await montoDirectoBtn.click();

    // Ingresar dinero contado en el input
    const inputFisico = page.getByPlaceholder('0');
    await inputFisico.fill('50000');

    // Comprobar que el valor se refleje en el campo
    await expect(inputFisico).toHaveValue('50000');
  });

  test('Hoja de Ruta Imprimible: Filtro por cobrador y vista consolidada', async ({ page }) => {
    await page.getByRole('button', { name: 'Hojas de Ruta (A4)', exact: true }).click();
    await expect(page.getByRole('button', { name: /Imprimir Planilla A4/i })).toBeVisible();

    // Cambiar selector de cobrador a TODOS
    const selectCobrador = page.locator('select').first();
    await selectCobrador.selectOption({ label: 'TODOS LOS COBRADORES (Consolidado)' });

    // Verificar que la vista consolidada se actualice
    await expect(selectCobrador).toHaveValue('TODOS');
  });
});
