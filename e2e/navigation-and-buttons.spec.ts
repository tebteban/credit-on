import { test, expect } from '@playwright/test';

test.describe('Navegación Integral y Verificación de Botones', () => {
  test.beforeEach(async ({ page }) => {
    // Inyectar sesión administrativa activa para acceder directamente al Backoffice
    await page.addInitScript(() => {
      window.localStorage.setItem('credit_on_e2e_session', 'admin');
    });
    await page.goto('/');
    await expect(page.getByText('Patrimonio Neto Operativo Valuado')).toBeVisible();
  });

  test('Debe recorrer todas las 8 vistas desde la barra lateral ejecutiva', async ({ page }) => {
    // 1. Clientes
    await page.getByRole('button', { name: 'Clientes', exact: true }).click();
    await expect(page.getByPlaceholder('Buscar por nombre, DNI o N° operación...')).toBeVisible();

    // 2. Cobradores
    await page.getByRole('button', { name: 'Cobradores', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Rendimiento de Cobradores' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Simular Rendimiento Hoy/i })).toBeVisible();

    // 3. Stock y Recuperación
    await page.getByRole('button', { name: 'Stock y Recuperación', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Gestión de Stock y Recuperación de Bienes' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Exportar Reporte CIAL/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Escanear IMEI \/ Serie/i })).toBeVisible();

    // 4. Alta de Operaciones
    await page.getByRole('button', { name: 'Alta de Operaciones', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Alta de Operaciones y Cronograma' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Préstamo en Efectivo/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Venta Electrodoméstico/i })).toBeVisible();

    // 5. Cierre de Caja y Arqueo
    await page.getByRole('button', { name: 'Cierre de Caja y Arqueo', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Cierre de Caja y Arqueo Diario' })).toBeVisible();
    await expect(page.getByText(/Seleccionar Cobrador para Arqueo/i)).toBeVisible();

    // 6. Hojas de Ruta (A4)
    await page.getByRole('button', { name: 'Hojas de Ruta (A4)', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Hojas de Ruta Imprimibles (A4)' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Imprimir Planilla A4/i })).toBeVisible();

    // 7. Terminal Cobrador PWA
    await page.getByRole('button', { name: 'Terminal Cobrador PWA', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Terminal Móvil de Campo (PWA Cobrador)' })).toBeVisible();

    // 8. Regreso al Dashboard
    await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard de Patrimonio y Valuación' })).toBeVisible();
    await expect(page.getByText(/Rendimiento y efectividad por cobrador/i)).toBeVisible();
  });

  test('Debe abrir, navegar pasos y cerrar la Guía Interactiva de Simulación', async ({ page }) => {
    // Abrir modal de guía desde el botón de la cabecera
    const helpBtn = page.getByRole('button', { name: /Guía de Prueba & Simulación/i });
    await expect(helpBtn).toBeVisible();
    await helpBtn.click();

    // Verificar que el modal esté visible
    await expect(page.getByText(/Simulador Completo de Operaciones Credit-On/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Preparación, Datos en Blanco/i })).toBeVisible();

    // Avanzar pasos
    const nextBtn = page.getByRole('button', { name: /Siguiente/i });
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await expect(page.getByRole('heading', { name: /Originación y Alta/i })).toBeVisible();
    }

    // Cerrar modal
    await page.getByTitle('Cerrar guía').click();
    await expect(page.getByText(/Simulador Completo de Operaciones Credit-On/i)).not.toBeVisible();
  });

  test('Debe abrir y cerrar el modal de Bienes en Riesgo en Stock y Recuperación', async ({ page }) => {
    await page.getByRole('button', { name: 'Stock y Recuperación', exact: true }).click();
    await expect(page.getByText(/Control de Stock Físico/i)).toBeVisible();

    // Clic en el botón/card de Bienes en Riesgo
    const bienesBtn = page.getByRole('button', { name: /Bienes en Riesgo/i }).first();
    await bienesBtn.click();

    // Comprobar apertura del modal de expedientes de recupero
    await expect(page.getByText(/Bienes Financiados en Riesgo de Recupero/i)).toBeVisible();

    // Cerrar el modal
    const cerrarModalBtn = page.getByRole('button', { name: /Cerrar/i }).last();
    await cerrarModalBtn.click();
    await expect(page.getByText(/Bienes Financiados en Riesgo de Recupero/i)).not.toBeVisible();
  });

  test('Debe abrir el modal de Escaneo de IMEI y alternar entre pestañas en Gestión de Stock', async ({ page }) => {
    await page.getByRole('button', { name: 'Stock y Recuperación', exact: true }).click();
    await expect(page.getByRole('button', { name: /Escanear IMEI \/ Serie/i })).toBeVisible();

    // Abrir modal de Escaneo de IMEI
    await page.getByRole('button', { name: /Escanear IMEI \/ Serie/i }).click();
    await expect(page.getByText(/Centro de Escaneo & Trazabilidad de Series/i)).toBeVisible();

    // Verificar pestaña 1 activa: Rastrear & Escanear
    await expect(page.getByPlaceholder(/Apuntá con la pistola lectora o escribí el IMEI/i)).toBeVisible();

    // Cambiar a pestaña 2: Vincular a Lote
    await page.getByRole('button', { name: /Vincular a Lote/i }).click();
    await expect(page.getByText(/Pegá o escaneá una lista de números de serie/i)).toBeVisible();

    // Cerrar el modal
    await page.getByRole('button', { name: /Cerrar/i }).last().click();
    await expect(page.getByText(/Centro de Escaneo & Trazabilidad de Series/i)).not.toBeVisible();
  });
});
