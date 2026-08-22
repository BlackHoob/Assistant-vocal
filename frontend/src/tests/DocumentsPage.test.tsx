import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DocumentsPage from "../pages/DocumentsPage";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        doc_passport: "Passeport",
        doc_visa: "Visa",
        doc_id_card: "Carte d'identité",
        doc_insurance: "Assurance",
        doc_vaccination: "Vaccination",
        doc_other: "Autre document",
        doc_import: "Importer",
        doc_replace: "Remplacer",
      })[key] || key,
  }),
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ token: "jwt-client" }),
}));

const sentDocument = {
  id: 11,
  name: "[passport] passeport-elie.pdf",
  file_path: "/uploads/passeport-elie.pdf",
  file_size: 2048,
  mime_type: "application/pdf",
  created_at: "2026-08-01T09:00:00.000Z",
  sent_by_admin: false,
};

const receivedDocument = {
  id: 12,
  name: "Billet Paris-Abidjan.pdf",
  file_path: "/uploads/billet-paris-abidjan.pdf",
  mime_type: "application/pdf",
  created_at: "2026-08-02T09:00:00.000Z",
  sent_by_admin: true,
};

function jsonResponse(data: unknown, ok = true) {
  return { ok, json: async () => data } as Response;
}

describe("DocumentsPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("charge les documents avec le token Bearer", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([]));

    render(<DocumentsPage />);

    expect(await screen.findByText("Passeport")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("http://localhost:4000/api/documents", {
      headers: { Authorization: "Bearer jwt-client" },
    });
  });

  it("sépare les documents envoyés des documents transmis par l'administrateur", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(
    jsonResponse([sentDocument, receivedDocument])
  );

  render(<DocumentsPage />);

  expect(
    await screen.findByText(/passeport-elie\.pdf/i)
  ).toBeInTheDocument();

  expect(
    screen.getByText(/1\s+envoyé\s*·\s*1\s+reçu/i)
  ).toBeInTheDocument();
});

  it("affiche les documents reçus dans leur onglet", async () => {
    const user = userEvent.setup();

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([receivedDocument]));
    render(<DocumentsPage />);

    await screen.findByText("Passeport");
    await user.click(screen.getByRole("button", { name: /Documents reçus/i }));

    expect(screen.getByText("Billet Paris-Abidjan.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Télécharger" })).toBeInTheDocument();
  });

  it("indique lorsqu'aucun document n'a été reçu", async () => {
    const user = userEvent.setup();

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([]));
    render(<DocumentsPage />);

    await screen.findByText("Passeport");
    await user.click(screen.getByRole("button", { name: /Documents reçus/i }));

    expect(screen.getByText("Aucun document reçu")).toBeInTheDocument();
  });

  it("ouvre une modale d'aperçu avec un nom accessible", async () => {
    const user = userEvent.setup();

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([sentDocument]));
    render(<DocumentsPage />);

    await user.click(await screen.findByText(/Importé le/i));

    const dialog = screen.getByRole("dialog", {
      name: "Aperçu du document [passport] passeport-elie.pdf",
    });

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveFocus();
    expect(screen.getByRole("button", { name: "Fermer l'aperçu" })).toBeInTheDocument();
  });

  it("ferme l'aperçu avec son bouton accessible", async () => {
    const user = userEvent.setup();

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([sentDocument]));
    render(<DocumentsPage />);

    await user.click(await screen.findByText(/Importé le/i));
    await user.click(screen.getByRole("button", { name: "Fermer l'aperçu" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ferme l'aperçu avec la touche Échap", async () => {
    const user = userEvent.setup();

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([sentDocument]));
    render(<DocumentsPage />);

    await user.click(await screen.findByText(/Importé le/i));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("envoie un document avec FormData puis recharge la liste", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ id: 11 }))
      .mockResolvedValueOnce(jsonResponse([sentDocument]));

    const view = render(<DocumentsPage />);
    await screen.findByText("Passeport");

    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["contenu"], "passeport-elie.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));

    const [url, options] = vi.mocked(fetch).mock.calls[1];
    const request = options as RequestInit;
    const body = request.body as FormData;

    expect(url).toBe("http://localhost:4000/api/documents/upload");
    expect(request.method).toBe("POST");
    expect(body.get("file")).toEqual(file);
    expect(body.get("name")).toBe("[passport] passeport-elie.pdf");
  });

  it("affiche l'erreur renvoyée lors d'un envoi refusé", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ message: "Fichier trop volumineux" }, false));

    const view = render(<DocumentsPage />);
    await screen.findByText("Passeport");

    fireEvent.change(view.container.querySelector('input[type="file"]')!, {
      target: { files: [new File(["contenu"], "passeport.pdf", { type: "application/pdf" })] },
    });

    expect(await screen.findByText("Fichier trop volumineux")).toBeInTheDocument();
  });

  it("supprime un document après confirmation", async () => {
    const user = userEvent.setup();

    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse([sentDocument]))
      .mockResolvedValueOnce(jsonResponse({}));

    render(<DocumentsPage />);

    const row = (await screen.findByText(/Importé le/i)).closest("div")!;
    const deleteButton = row.querySelector("button") as HTMLButtonElement;

    await user.click(deleteButton);

    expect(fetch).toHaveBeenCalledWith("http://localhost:4000/api/documents/11", {
      method: "DELETE",
      headers: { Authorization: "Bearer jwt-client" },
    });
    await waitFor(() => expect(screen.queryByText("passeport-elie.pdf")).not.toBeInTheDocument());
  });

  it("ouvre le fichier reçu dans un nouvel onglet", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockImplementation(() => null);

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([receivedDocument]));
    render(<DocumentsPage />);

    await screen.findByText("Passeport");
    await user.click(screen.getByRole("button", { name: /Documents reçus/i }));
    await user.click(screen.getByRole("button", { name: "Télécharger" }));

    expect(open).toHaveBeenCalledWith(
      "http://localhost:4000/uploads/billet-paris-abidjan.pdf",
      "_blank",
    );
  });
});
