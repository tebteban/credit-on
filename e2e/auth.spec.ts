import { test, expect } from '@playwright/test';

test.describe('Autenticación y Control de Acceso (AdminAccessGate)', () => {
  test.beforeEach(async ({ page }) => {
    // Limpiar cualquier sesión previa antes de cada prueba de login
    await page.addInitScript(() => {
      window.localStorage.removeItem('credit_on_e2e_session');
    });
  });

  test('Debe mostrar la pantalla institucional de Inicio de Sesión', async ({ page }) => {
    await page.goto('/');

    // Verificar branding institucional
    await expect(page.getByText('Inicio de Sesión')).toBeVisible();
    await expect(page.getByText('Sistema Integral CREDIT-ON')).toBeVisible();
    await expect(page.getByText('Santiago del Estero')).toBeVisible();
    await expect(page.getByLabel(/Correo electrónico/i)).toBeVisible();
    await expect(page.getByLabel(/Contraseña/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Ingresar al Sistema/i })).toBeVisible();
  });

  test('Debe alternar la visibilidad de la contraseña al hacer clic en el ojo', async ({ page }) => {
    await page.goto('/');

    const passwordInput = page.getByLabel(/Contraseña/i);
    await passwordInput.fill('MiClaveSecreta');

    // Por defecto es de tipo password
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Clic en el botón de ver contraseña
    const toggleBtn = page.getByTitle(/Ver contraseña|Ocultar contraseña/i);
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Clic nuevamente para volver a ocultarla
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('Debe mostrar alerta de error con credenciales incorrectas', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel(/Correo electrónico/i).fill('usuario_falso@credit-on.com');
    await page.getByLabel(/Contraseña/i).fill('clave_erronea_123');
    await page.getByRole('button', { name: /Ingresar al Sistema/i }).click();

    // Esperar mensaje de error
    const errorAlert = page.getByRole('alert');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText(/Correo electrónico o contraseña incorrectos/i);
  });

  test('Debe ingresar exitosamente al Backoffice con credenciales administrativas autorizadas', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel(/Correo electrónico/i).fill('admin@credit-on.com');
    await page.getByLabel(/Contraseña/i).fill('admin123');
    await page.getByRole('button', { name: /Ingresar al Sistema/i }).click();

    // Comprobar que entramos al Backoffice y la barra lateral ejecutiva está visible
    await expect(page.getByText('Patrimonio Neto Operativo Valuado')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clientes', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cobradores', exact: true })).toBeVisible();
  });
});
