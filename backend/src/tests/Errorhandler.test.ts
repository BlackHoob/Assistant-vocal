import { errorHandler } from '../middleware/errorHandler';
import { ValidationError } from '../errors/AppError';

describe('errorHandler', () => {
  const mockRes = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  it('doit renvoyer le statut et le message d\'une AppError sans la journaliser', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = mockRes();
    const err = new ValidationError('Champ requis');

    errorHandler(err, {} as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Champ requis', code: err.code });
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('doit renvoyer un message générique pour une erreur inattendue', () => {
    const res = mockRes();
    const err = new Error('Erreur imprévue de la base de données');

    errorHandler(err, {} as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Erreur interne du serveur' });
  });

  it('doit aussi gérer les erreurs qui ne sont pas des instances de Error', () => {
    const res = mockRes();
    const err = 'chaîne brute, pas un objet Error';

    errorHandler(err, {} as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Erreur interne du serveur' });
  });
});