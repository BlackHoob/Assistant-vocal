import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";

const authMocks = vi.hoisted(() => ({
  init: vi.fn(),
  state: {
    user: null as null | { id: number; name: string },
    loading: false,
    adminUser: null as null | { id: number; username: string },
  },
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    ...authMocks.state,
    init: authMocks.init,
    isAdmin: () => Boolean(authMocks.state.adminUser),
  }),
}));

vi.mock("../components/Layout", async () => {
  const router = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { default: () => <router.Outlet /> };
});

vi.mock("../components/Adminlayout", async () => {
  const router = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { default: () => <router.Outlet /> };
});

vi.mock("../pages/IAPage", () => ({ default: () => <div>Assistant vocal</div> }));
vi.mock("../pages/LoginPage", () => ({ default: () => <div>Connexion client</div> }));
vi.mock("../pages/ForgotPasswordPage", () => ({
  default: () => <div>Mot de passe oublié</div>,
}));
vi.mock("../pages/ResetPasswordPage", () => ({
  default: () => <div>Réinitialisation du mot de passe</div>,
}));
vi.mock("../pages/RegisterPage", () => ({ default: () => <div>Inscription client</div> }));
vi.mock("../pages/AuthCallback", () => ({ default: () => <div>Retour OAuth</div> }));
vi.mock("../pages/AppointmentsPage", () => ({ default: () => <div>Mes rendez-vous</div> }));
vi.mock("../pages/DocumentsPage", () => ({ default: () => <div>Mes documents</div> }));
vi.mock("../pages/TicketsPage", () => ({ default: () => <div>Mes billets</div> }));
vi.mock("../pages/ProfilePage", () => ({ default: () => <div>Mon profil</div> }));
vi.mock("../pages/HomePage", () => ({ default: () => <div>Accueil client</div> }));
vi.mock("../pages/admin/AdminLoginPage", () => ({
  default: () => <div>Connexion administrateur</div>,
}));
vi.mock("../pages/admin/AdminDashboardPage", () => ({
  default: () => <div>Tableau de bord administrateur</div>,
}));
vi.mock("../pages/admin/AdminUsersPage", () => ({
  default: () => <div>Gestion des utilisateurs</div>,
}));
vi.mock("../pages/admin/AdminAppointmentsPage", () => ({
  default: () => <div>Gestion des rendez-vous</div>,
}));
vi.mock("../pages/admin/AdminWeeklyPage", () => ({
  default: () => <div>Planning hebdomadaire</div>,
}));
vi.mock("../pages/admin/AdminTicketsPage", () => ({
  default: () => <div>Gestion des billets</div>,
}));
vi.mock("../pages/admin/AdminAdminsPage", () => ({
  default: () => <div>Gestion des administrateurs</div>,
}));
vi.mock("../pages/admin/AdminMessagesPage", () => ({
  default: () => <div>Messages administrateur</div>,
}));
vi.mock("../pages/admin/AdminDocumentsPage", () => ({
  default: () => <div>Documents administrateur</div>,
}));

function openPath(path: string) {
  window.history.pushState({}, "", path);
  return render(<App />);
}

describe("Routes de l'application", () => {
  beforeEach(() => {
    authMocks.init.mockReset();
    authMocks.state.user = null;
    authMocks.state.loading = false;
    authMocks.state.adminUser = null;
  });

  it("initialise la session au démarrage", () => {
    openPath("/login");

    expect(authMocks.init).toHaveBeenCalledTimes(1);
  });

  it("redirige un visiteur non connecté vers la page de connexion", async () => {
    openPath("/documents");

    expect(await screen.findByText("Connexion client")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
  });

  it("autorise un client connecté à consulter ses documents", async () => {
    authMocks.state.user = { id: 7, name: "Elie" };

    openPath("/documents");

    expect(await screen.findByText("Mes documents")).toBeInTheDocument();
  });

  it("redirige un client connecté qui ouvre la page de connexion", async () => {
    authMocks.state.user = { id: 7, name: "Elie" };

    openPath("/login");

    expect(await screen.findByText("Accueil client")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("redirige un visiteur non administrateur vers la connexion administrateur", async () => {
    openPath("/admin");

    expect(await screen.findByText("Connexion administrateur")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/admin/login");
  });

  it("autorise un administrateur à ouvrir son tableau de bord", async () => {
    authMocks.state.adminUser = { id: 2, username: "Nestor" };

    openPath("/admin");

    expect(await screen.findByText("Tableau de bord administrateur")).toBeInTheDocument();
  });

  it("affiche l'indicateur de chargement tant que la session est initialisée", () => {
    authMocks.state.loading = true;

    const view = openPath("/documents");

    expect(view.container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.queryByText("Connexion client")).not.toBeInTheDocument();
  });

  it("redirige une route inconnue vers l'accueil puis vers la connexion", async () => {
    openPath("/adresse-inconnue");

    expect(await screen.findByText("Connexion client")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
  });
});
