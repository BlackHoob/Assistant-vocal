import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppointmentsPage from "../pages/AppointmentsPage";

const pageMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
  refreshNotifications: vi.fn(),

  user: {
    id: 7,
    name: "Kouakou Elie Marc",
  },  
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => (key === "apt_title" ? "Rendez-vous" : key) }),
}));

vi.mock("../hooks/useApi", () => ({
  useApi: () => ({
    get: pageMocks.get,
    post: pageMocks.post,
    put: pageMocks.put,
    del: pageMocks.del,
  }),
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: pageMocks.user,
  }),
}));

vi.mock("../hooks/useNotification", () => ({
  triggerNotificationsRefresh: pageMocks.refreshNotifications,
}));

const appointment = {
  id: 14,
  title: "Consultation",
  description: "Préparation du voyage",
  dateTime: "2030-01-15T10:30:00.000Z",
  location: "M. Kouakou Nesto",
  quantity: 2,
  status: "upcoming" as const,
};

function prepareApi(appointments: object[] = []) {
  pageMocks.get.mockImplementation(async (path: string) => {
    if (path === "/appointments") return appointments;
    if (path.startsWith("/appointments/taken")) return { takenSlots: [] };
    if (path.startsWith("/appointments/waitlist/me")) return null;
    return [];
  });
  pageMocks.post.mockResolvedValue({});
  pageMocks.put.mockResolvedValue({});
  pageMocks.del.mockResolvedValue({});
}

async function openAppointmentForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Prendre un rendez-vous" }));
  await user.click(screen.getByRole("button", { name: "Consultation" }));
  await user.click(screen.getByRole("button", { name: "M. Kouakou Nesto" }));
}

describe("AppointmentsPage", () => {
  beforeEach(() => {
    localStorage.clear();
    pageMocks.get.mockReset();
    pageMocks.post.mockReset();
    pageMocks.put.mockReset();
    pageMocks.del.mockReset();
    pageMocks.refreshNotifications.mockReset();
    prepareApi();
  });

  it("charge les rendez-vous et affiche l'état vide", async () => {
    render(<AppointmentsPage />);

    expect(await screen.findByText("Aucun rendez-vous à venir")).toBeInTheDocument();
    expect(pageMocks.get).toHaveBeenCalledWith("/appointments");
  });

  it("affiche les rendez-vous à venir avec leur agent et leur quantité", async () => {
    prepareApi([appointment]);

    render(<AppointmentsPage />);

    expect(await screen.findByText("Consultation")).toBeInTheDocument();
    expect(screen.getByText("Préparation du voyage")).toBeInTheDocument();
    expect(screen.getByText("M. Kouakou Nesto")).toBeInTheDocument();
    expect(screen.getByText("2 personnes")).toBeInTheDocument();
  });

  it("affiche les rendez-vous terminés dans l'onglet Passés", async () => {
    const user = userEvent.setup();

    prepareApi([{ ...appointment, status: "completed" }]);
    render(<AppointmentsPage />);

    await screen.findByText("Aucun rendez-vous à venir");
    await user.click(screen.getByRole("button", { name: "Passés" }));

    expect(screen.getByText("Consultation")).toBeInTheDocument();
    expect(screen.getByText("Terminé")).toBeInTheDocument();
  });

  it("vérifie la disponibilité d'un créneau puis crée un rendez-vous", async () => {
    const user = userEvent.setup();
    const view = render(<AppointmentsPage />);

    await openAppointmentForm(user);

    const dateTime = view.container.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    fireEvent.change(dateTime, { target: { value: "2030-01-15T10:30" } });

    await waitFor(() => {
      expect(pageMocks.get).toHaveBeenCalledWith("/appointments/taken?date=2030-01-15");
    });

    await user.click(screen.getByRole("button", { name: "Confirmer le rendez-vous" }));

    await waitFor(() => {
      expect(pageMocks.post).toHaveBeenCalledWith("/appointments", {
        title: "Consultation",
        description: "",
        dateTime: "2030-01-15T10:30",
        quantity: 1,
        agent: "M. Kouakou Nesto",
      });
    });

    await waitFor(() => expect(pageMocks.refreshNotifications).toHaveBeenCalledTimes(1));
  });

  it("désactive la confirmation lorsqu'un créneau est déjà réservé", async () => {
    const user = userEvent.setup();

    pageMocks.get.mockImplementation(async (path: string) => {
      if (path === "/appointments") return [];
      if (path.startsWith("/appointments/taken")) return { takenSlots: ["10:30"] };
      return null;
    });

    const view = render(<AppointmentsPage />);
    await openAppointmentForm(user);

    fireEvent.change(view.container.querySelector('input[type="datetime-local"]')!, {
      target: { value: "2030-01-15T10:30" },
    });

    expect(await screen.findByText("Ce créneau est déjà réservé.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmer le rendez-vous" })).toBeDisabled();
    expect(pageMocks.post).not.toHaveBeenCalled();
  });

  it("supprime un rendez-vous après confirmation", async () => {
    const user = userEvent.setup();

    prepareApi([appointment]);
    vi.stubGlobal("confirm", vi.fn(() => true));
    render(<AppointmentsPage />);

    await screen.findByText("Consultation");
    await user.click(screen.getByTitle("Supprimer"));

    expect(pageMocks.del).toHaveBeenCalledWith("/appointments/14");
    await waitFor(() => expect(screen.queryByText("Consultation")).not.toBeInTheDocument());
  });

  it("ne supprime rien lorsque la confirmation est annulée", async () => {
    const user = userEvent.setup();

    prepareApi([appointment]);
    vi.stubGlobal("confirm", vi.fn(() => false));
    render(<AppointmentsPage />);

    await screen.findByText("Consultation");
    await user.click(screen.getByTitle("Supprimer"));

    expect(pageMocks.del).not.toHaveBeenCalled();
  });

  it("marque un rendez-vous comme terminé et actualise les notifications", async () => {
    const user = userEvent.setup();

    prepareApi([appointment]);
    render(<AppointmentsPage />);

    await screen.findByText("Consultation");
    await user.click(screen.getByTitle("Marquer terminé"));

    await waitFor(() => {
      expect(pageMocks.put).toHaveBeenCalledWith("/appointments/14", {
        ...appointment,
        status: "completed",
      });
    });

    await waitFor(() => expect(pageMocks.refreshNotifications).toHaveBeenCalledTimes(1));
  });

  it("préremplit le nom et mémorise la date de la liste d'attente", async () => {
    const user = userEvent.setup();
    const view = render(<AppointmentsPage />);

    await screen.findByText("Aucun rendez-vous à venir");
    await user.click(screen.getByRole("button", { name: "Liste d'attente" }));

    fireEvent.change(view.container.querySelector('input[type="date"]')!, {
      target: { value: "2030-01-15" },
    });

    expect(await screen.findByPlaceholderText("Nom complet")).toHaveValue("Kouakou Elie Marc");
    expect(localStorage.getItem("nestor_waitlist_date")).toBe("2030-01-15");
  });

  it("inscrit l'utilisateur sur la liste d'attente", async () => {
    const user = userEvent.setup();

    pageMocks.post.mockResolvedValueOnce({
      id: 22,
      name: "Kouakou Elie Marc",
      date: "2030-01-15",
      quantity: 1,
      rank: 2,
      total: 4,
    });

    const view = render(<AppointmentsPage />);
    await screen.findByText("Aucun rendez-vous à venir");
    await user.click(screen.getByRole("button", { name: "Liste d'attente" }));

    fireEvent.change(view.container.querySelector('input[type="date"]')!, {
      target: { value: "2030-01-15" },
    });

    await user.click(await screen.findByRole("button", { name: "Confirmer mon inscription" }));

    await waitFor(() => {
      expect(pageMocks.post).toHaveBeenCalledWith("/appointments/waitlist", {
        date: "2030-01-15",
        name: "Kouakou Elie Marc",
        quantity: 1,
      });
    });

    expect(await screen.findByText("#2")).toBeInTheDocument();
    await waitFor(() => expect(pageMocks.refreshNotifications).toHaveBeenCalledTimes(1));
  });
});
