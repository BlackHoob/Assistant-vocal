import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RegisterPage from "../pages/RegisterPage";

const authMocks = vi.hoisted(() => ({ setAuth: vi.fn() }));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ setAuth: authMocks.setAuth }),
}));

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<div>Compte créé</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillRegisterForm(
  user: ReturnType<typeof userEvent.setup>,
  password = "MotDePasse123!",
) {
  await user.type(screen.getByPlaceholderText("Jean Dupont"), "Kouakou Elie Marc");
  await user.type(screen.getByPlaceholderText("vous@exemple.com"), "elie@example.com");
  await user.type(screen.getByPlaceholderText("Min. 8 caractères"), password);
}

describe("RegisterPage", () => {
  beforeEach(() => {
    authMocks.setAuth.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("affiche les champs et le lien vers la connexion", () => {
    renderRegister();

    expect(screen.getByRole("heading", { name: "Créer un compte" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Jean Dupont")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("vous@exemple.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Min. 8 caractères")).toHaveAttribute("type", "password");
    expect(screen.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", "/login");
  });

  it("refuse un mot de passe de moins de huit caractères sans appeler l'API", async () => {
    const user = userEvent.setup();

    renderRegister();
    await fillRegisterForm(user, "court");
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));

    expect(await screen.findByText("Mot de passe min. 8 caractères")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("envoie le nom, l'email et le mot de passe puis ouvre la session", async () => {
    const user = userEvent.setup();
    const account = { id: 7, name: "Kouakou Elie Marc", email: "elie@example.com" };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "jwt-nouveau-compte", user: account }),
    } as Response);

    renderRegister();
    await fillRegisterForm(user);
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/auth/register",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Kouakou Elie Marc",
          email: "elie@example.com",
          password: "MotDePasse123!",
        }),
      }),
    );
    expect(authMocks.setAuth).toHaveBeenCalledWith("jwt-nouveau-compte", account);
    expect(await screen.findByText("Compte créé")).toBeInTheDocument();
  });

  it("affiche l'erreur renvoyée pour un email déjà utilisé", async () => {
    const user = userEvent.setup();

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "Cette adresse email est déjà utilisée" }),
    } as Response);

    renderRegister();
    await fillRegisterForm(user);
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));

    expect(
      await screen.findByText("Cette adresse email est déjà utilisée"),
    ).toBeInTheDocument();
    expect(authMocks.setAuth).not.toHaveBeenCalled();
  });

  it("affiche une erreur de connexion si le réseau est indisponible", async () => {
    const user = userEvent.setup();

    vi.mocked(fetch).mockRejectedValueOnce(new Error("Réseau indisponible"));

    renderRegister();
    await fillRegisterForm(user);
    await user.click(screen.getByRole("button", { name: "Créer mon compte" }));

    expect(await screen.findByText("Erreur de connexion")).toBeInTheDocument();
  });

  it("permet d'afficher et de masquer le mot de passe", async () => {
    const user = userEvent.setup();
    const view = renderRegister();
    const password = screen.getByPlaceholderText("Min. 8 caractères");
    const toggle = view.container.querySelector('button[type="button"]') as HTMLButtonElement;

    await user.click(toggle);
    expect(password).toHaveAttribute("type", "text");

    await user.click(toggle);
    expect(password).toHaveAttribute("type", "password");
  });
});
