import { createFileFilter } from '../utils/fileUpload';

describe('createFileFilter', () => {
  const filter = createFileFilter(['image/png', 'image/jpeg']);

  function fakeFile(mimetype: string): Express.Multer.File {
    return { mimetype } as Express.Multer.File;
  }

  it('accepte un type MIME présent dans la liste autorisée', () => {
    const cb = jest.fn();

    filter!({} as any, fakeFile('image/png'), cb);

    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('refuse un type MIME absent de la liste autorisée', () => {
    const cb = jest.fn();

    filter!({} as any, fakeFile('text/html'), cb);

    expect(cb).toHaveBeenCalledTimes(1);
    const [err] = cb.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('text/html');
  });

  it('refuse un fichier SVG, pouvant contenir du script exécutable', () => {
    const cb = jest.fn();

    filter!({} as any, fakeFile('image/svg+xml'), cb);

    const [err] = cb.mock.calls[0];
    expect(err).toBeDefined();
  });

  it('applique une liste différente selon les appelants (ex. documents : images et PDF)', () => {
    const documentFilter = createFileFilter(['image/jpeg', 'application/pdf']);
    const cb = jest.fn();

    documentFilter!({} as any, fakeFile('application/pdf'), cb);

    expect(cb).toHaveBeenCalledWith(null, true);
  });
});