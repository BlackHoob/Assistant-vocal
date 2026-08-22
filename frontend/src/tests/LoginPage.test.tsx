import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "../pages/LoginPage";

const authMocks = vi.hoisted(() => ({ setAuth: vi.fn() }));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ setAuth: authMocks.setAuth }),
}));

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>Accueil privé</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillLoginForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText("vous@exemple.com"), "elie@example.com");
  await user.type(screen.getByPlaceholderText("••••••••"), "MotDePasse123!");
}

describe("LoginPage", () => {
  beforeEach(() => {
    authMocks.setAuth.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("affiche le formulaire et les moyens de connexion", () => {
    renderLogin();

    expect(screen.getByRole("heading", { name: "Bon retour" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("vous@exemple.com")).toHaveAttribute("type", "email");
    expect(screen.getByPlaceholderText("••••••••")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Se connecter" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuer avec Google" })).toBeInTheDocument();
  });

  it("propose les liens inscription, mot de passe oublié et administration", () => {
    renderLogin();

    expect(screen.getByRole("link", { name: "S'inscrire" })).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: /Mot de passe oublié/i })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin/login");
  });

  it("permet d'afficher puis masquer le mot de passe", async () => {
    const user = userEvent.setup();
    const view = renderLogin();
    const password = screen.getByPlaceholderText("••••••••");
    const toggle = view.container.querySelector('button[type="button"]') as HTMLButtonElement;

    await user.click(toggle);
    expect(password).toHaveAttribute("type", "text");

    await user.click(toggle);
    expect(password).toHaveAttribute("type", "password");
  });

  it("envoie les identifiants à l'API et redirige après connexion", async () => {
    const user = userEvent.setup();
    const account = { id: 7, name: "Elie", email: "elie@example.com" };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "jwt-client", user: account }),
    } as Response);

    renderLogin();
    await fillLoginForm(user);
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:4000/api/auth/login",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "elie@example.com",
            password: "MotDePasse123!",
          }),
        }),
      );
    });

    expect(authMocks.setAuth).toHaveBeenCalledWith("jwt-client", account);
    expect(await screen.findByText("Accueil privé")).toBeInTheDocument();
  });

  it("affiche le message renvoyé par l'API si les identifiants sont invalides", async () => {
    const user = userEvent.setup();

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "Identifiants incorrects" }),
    } as Response);

    renderLogin();
    await fillLoginForm(user);
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(await screen.findByText("Identifiants incorrects")).toBeInTheDocument();
    expect(authMocks.setAuth).not.toHaveBeenCalled();
  });

  it("affiche une erreur compréhensible lorsque le serveur ne répond pas", async () => {
    const user = userEvent.setup();

    vi.mocked(fetch).mockRejectedValueOnce(new Error("Failed to fetch"));

    renderLogin();
    await fillLoginForm(user);
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(await screen.findByText("Erreur de connexion")).toBeInTheDocument();
  });
});
