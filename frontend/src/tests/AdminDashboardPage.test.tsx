import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminDashboardPage from "../pages/admin/AdminDashboardPage";

const dashboardMocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../hooks/useAdminApi", () => ({
  useAdminApi: () => ({ get: dashboardMocks.get }),
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ adminUser: { username: "Nestor" } }),
}));

const stats = {
  totalUsers: 17,
  totalAppointments: 8,
  upcomingAppointments: 3,
  totalTickets: 5,
  upcomingTickets: 2,
  totalDocuments: 11,
  ia: {
    conversationsToday: 4,
    totalUsers: 9,
    conversionRate: 25,
  },
  bookingsByMonth: [{ month: "2026-08", appointments: 8, tickets: 5 }],
  newUsersByMonth: [{ month: "2026-08", count: 17 }],
  topDestinations: [{ destination: "Abidjan", count: 5 }],
  recentActivity: [{ type: "appointment", date: "2026-08-20", count: 2 }],
};

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    dashboardMocks.get.mockReset();
    dashboardMocks.get.mockResolvedValue(stats);
  });

  it("demande les statistiques d'administration", async () => {
    render(<AdminDashboardPage />);

    await screen.findByText("Vue d'ensemble Nestor Vocal");

    expect(dashboardMocks.get).toHaveBeenCalledWith("/admin/stats");
  });

  it("accueille l'administrateur avec son nom", async () => {
    render(<AdminDashboardPage />);

    expect(await screen.findByText("Nestor")).toBeInTheDocument();
  });

  it("affiche les principaux compteurs du tableau de bord", async () => {
    render(<AdminDashboardPage />);

    await screen.findByText("Vue d'ensemble Nestor Vocal");

    expect(screen.getByText("17")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("3 à venir")).toBeInTheDocument();
    expect(screen.getByText("2 à venir")).toBeInTheDocument();
  });

  it("affiche les indicateurs de l'assistant vocal", async () => {
    render(<AdminDashboardPage />);

    expect(await screen.findByText("Échanges IA aujourd'hui")).toBeInTheDocument();
    expect(screen.getByText("Utilisateurs ayant parlé à Nestor")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
  });

  it("affiche les destinations, graphiques et activités récentes", async () => {
    render(<AdminDashboardPage />);

    expect(await screen.findByText("Abidjan")).toBeInTheDocument();
    expect(screen.getByText("Réservations par mois")).toBeInTheDocument();
    expect(screen.getByText("Nouveaux utilisateurs")).toBeInTheDocument();
    expect(screen.getByText("Activité récente (7 jours)")).toBeInTheDocument();
    expect(screen.getByTitle("Rendez-vous : 8")).toBeInTheDocument();
  });

  it("affiche les messages d'état vide lorsqu'aucune activité n'existe", async () => {
    dashboardMocks.get.mockResolvedValueOnce({
      ...stats,
      bookingsByMonth: [],
      newUsersByMonth: [],
      topDestinations: [],
      recentActivity: [],
    });

    render(<AdminDashboardPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Pas encore de données")).toHaveLength(2);
    });
    expect(screen.getByText("Aucun billet enregistré")).toBeInTheDocument();
    expect(screen.getByText("Aucune activité récente")).toBeInTheDocument();
  });

  it("présente un indicateur pendant le chargement", () => {
    dashboardMocks.get.mockReturnValueOnce(new Promise(() => {}));

    const view = render(<AdminDashboardPage />);

    expect(view.container.querySelector(".animate-spin")).toBeInTheDocument();
  });
});
