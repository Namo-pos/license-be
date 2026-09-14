import { Router } from 'express';
import { LicenseController } from '../controllers/license.controller.js';

export const licenseRouter = Router();

licenseRouter.post('/register', LicenseController.register);
licenseRouter.post('/verify-admin', LicenseController.verifyAdmin);
licenseRouter.post('/activate', LicenseController.activate);
licenseRouter.post('/activate-device', LicenseController.activateDevice);
licenseRouter.post('/refresh-lease', LicenseController.refreshLease);
licenseRouter.post('/renew', LicenseController.renew);
licenseRouter.post('/deactivate-device', LicenseController.deactivateDevice);
licenseRouter.get('/public-key', LicenseController.getPublicKey);
licenseRouter.get('/benefits', LicenseController.getBenefits);
licenseRouter.get('/benefits/:plan', LicenseController.getBenefitByPlan);
licenseRouter.get('/status/:key', LicenseController.getStatus);
licenseRouter.get('/list', LicenseController.listAll);
licenseRouter.delete('/:key', LicenseController.delete);
