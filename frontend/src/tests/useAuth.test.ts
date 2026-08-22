import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../hooks/useAuth";

const user = {
  id: 7,
  name: "Kouakou Elie Marc",
  email: "elie@example.com",
};

const admin = {
  id: 2,
  username: "nestor-admin",
  email: "admin@example.com",
  role: "admin",
};

describe("useAuth", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuth.setState({
      user: null,
      token: null,
      loading: true,
      adminToken: null,
      adminUser: null,
    });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("enregistre le token et l'utilisateur après connexion", () => {
    useAuth.getState().setAuth("token-client", user);

    expect(useAuth.getState().token).toBe("token-client");
    expect(useAuth.getState().user).toEqual(user);
  });

  it("persiste l'authentification utilisateur dans localStorage", () => {
    useAuth.getState().setAuth("token-client", user);

    const persisted = JSON.parse(localStorage.getItem("nestor-auth") || "{}");

    expect(persisted.state.token).toBe("token-client");
    expect(persisted.state.user).toEqual(user);
  });

  it("enregistre l'authentification administrateur", () => {
    useAuth.getState().setAdmin("token-admin", admin);

    expect(useAuth.getState().adminToken).toBe("token-admin");
    expect(useAuth.getState().adminUser).toEqual(admin);
    expect(useAuth.getState().isAdmin()).toBe(true);
  });

  it("refuse le statut administrateur sans token et compte administrateur", () => {
    expect(useAuth.getState().isAdmin()).toBe(false);

    useAuth.setState({ adminToken: "token-seul", adminUser: null });

    expect(useAuth.getState().isAdmin()).toBe(false);
  });

  it("déconnecte uniquement l'administrateur avec logoutAdmin", () => {
    useAuth.getState().setAuth("token-client", user);
    useAuth.getState().setAdmin("token-admin", admin);

    useAuth.getState().logoutAdmin();

    expect(useAuth.getState().adminToken).toBeNull();
    expect(useAuth.getState().adminUser).toBeNull();
    expect(useAuth.getState().token).toBe("token-client");
    expect(useAuth.getState().user).toEqual(user);
  });

  it("efface toutes les sessions avec logout", () => {
    useAuth.getState().setAuth("token-client", user);
    useAuth.getState().setAdmin("token-admin", admin);

    useAuth.getState().logout();

    expect(useAuth.getState().token).toBeNull();
    expect(useAuth.getState().user).toBeNull();
    expect(useAuth.getState().adminToken).toBeNull();
    expect(useAuth.getState().adminUser).toBeNull();
  });

  it("termine l'initialisation sans requête lorsqu'aucun token n'existe", async () => {
    await useAuth.getState().init();

    expect(fetch).not.toHaveBeenCalled();
    expect(useAuth.getState().loading).toBe(false);
  });

  it("récupère l'utilisateur avec le token Bearer existant", async () => {
    useAuth.setState({ token: "token-client" });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => user,
    } as Response);

    await useAuth.getState().init();

    expect(fetch).toHaveBeenCalledWith("http://localhost:4000/api/auth/me", {
      headers: { Authorization: "Bearer token-client" },
    });
    expect(useAuth.getState().user).toEqual(user);
    expect(useAuth.getState().loading).toBe(false);
  });

  it("supprime une session dont le token est refusé", async () => {
    useAuth.setState({ token: "token-expire", user });
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);

    await useAuth.getState().init();

    expect(useAuth.getState().token).toBeNull();
    expect(useAuth.getState().user).toBeNull();
    expect(useAuth.getState().loading).toBe(false);
  });

  it("arrête le chargement après une erreur réseau", async () => {
    useAuth.setState({ token: "token-client" });
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Réseau indisponible"));

    await useAuth.getState().init();

    expect(useAuth.getState().loading).toBe(false);
    expect(useAuth.getState().token).toBe("token-client");
  });
});
