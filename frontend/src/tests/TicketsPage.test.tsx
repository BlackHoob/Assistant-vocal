import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TicketsPage from "../pages/TicketsPage";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  del: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        tkt_mine: "Mes billets",
        tkt_search: "Rechercher un vol",
        tkt_searching: "Recherche en cours",
        tkt_no_result: "Aucun vol trouvé",
        tkt_save: "Enregistrer",
        tkt_saved: "Enregistré",
      })[key] || key,
  }),
}));

vi.mock("../hooks/useApi", () => ({
  useApi: () => ({ get: apiMocks.get, post: apiMocks.post, del: apiMocks.del }),
}));

const ticket = {
  id: 15,
  flightNumber: "AF702",
  airline: "Air France",
  origin: "CDG",
  destination: "ABJ",
  departureDate: "2030-01-15T10:30:00.000Z",
  arrivalDate: "2030-01-15T17:30:00.000Z",
  price: 450,
  currency: "EUR",
  status: "upcoming" as const,
};

const offer = {
  id: "offer-1",
  airline: "Air France",
  airlineLogo: "",
  flightNumber: "AF702",
  origin: "CDG",
  destination: "ABJ",
  departureDate: "2030-01-15T10:30:00.000Z",
  arrivalDate: "2030-01-15T17:30:00.000Z",
  duration: "7 h",
  stops: 0,
  cabinClass: "economy",
  price: 450,
  currency: "EUR",
  expiresAt: "2030-01-16T00:00:00.000Z",
};

async function openSearch(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText("Aucun billet enregistré");
  await user.click(screen.getAllByRole("button", { name: "Rechercher un vol" })[0]);
}

async function fillSearch(
  user: ReturnType<typeof userEvent.setup>,
  container: HTMLElement,
) {
  await user.type(screen.getByPlaceholderText("ex : Jean Dupont"), "Kouakou Elie Marc");
  await user.type(screen.getByPlaceholderText("ex : CDG"), "cdg");
  await user.type(screen.getByPlaceholderText("ex : JFK"), "abj");
  fireEvent.change(container.querySelector('input[type="date"]')!, {
    target: { value: "2030-01-15" },
  });
}

describe("TicketsPage", () => {
  beforeEach(() => {
    apiMocks.get.mockReset();
    apiMocks.post.mockReset();
    apiMocks.del.mockReset();
    apiMocks.get.mockResolvedValue([]);
    apiMocks.del.mockResolvedValue({});
  });

  it("charge les billets et affiche l'état vide", async () => {
    render(<TicketsPage />);

    expect(await screen.findByText("Aucun billet enregistré")).toBeInTheDocument();
    expect(apiMocks.get).toHaveBeenCalledWith("/tickets");
  });

  it("affiche les informations d'un billet enregistré", async () => {
    apiMocks.get.mockResolvedValueOnce([ticket]);

    render(<TicketsPage />);

    const flightNumber = await screen.findByText("AF702");

    expect(flightNumber).toBeInTheDocument();
    expect(screen.getByText("Air France")).toBeInTheDocument();
    expect(flightNumber.closest(".card")).toHaveTextContent("CDG");
    expect(flightNumber.closest(".card")).toHaveTextContent("ABJ");
  });

  it("affiche les anciens billets dans l'historique", async () => {
    apiMocks.get.mockResolvedValueOnce([{ ...ticket, status: "completed" }]);

    render(<TicketsPage />);

    expect(await screen.findByText("Historique")).toBeInTheDocument();
    expect(screen.getByText("Terminé")).toBeInTheDocument();
  });

  it("met automatiquement les codes aéroport en majuscules", async () => {
    const user = userEvent.setup();
    const view = render(<TicketsPage />);

    await openSearch(user);
    await fillSearch(user, view.container);

    expect(screen.getByPlaceholderText("ex : CDG")).toHaveValue("CDG");
    expect(screen.getByPlaceholderText("ex : JFK")).toHaveValue("ABJ");
  });

  it("recherche des vols et affiche les offres disponibles", async () => {
    const user = userEvent.setup();

    apiMocks.post.mockResolvedValueOnce([offer]);

    const view = render(<TicketsPage />);
    await openSearch(user);
    await fillSearch(user, view.container);

    const form = view.container.querySelector("form")!;
    await user.click(within(form).getByRole("button", { name: "Rechercher un vol" }));

    await waitFor(() => {
      expect(apiMocks.post).toHaveBeenCalledWith("/tickets/search", {
        name: "Kouakou Elie Marc",
        origin: "CDG",
        destination: "ABJ",
        date: "2030-01-15",
        passengers: 1,
        cabinClass: "economy",
      });
    });

    expect(await screen.findByText("AF702")).toBeInTheDocument();
    expect(screen.getByText("Direct")).toBeInTheDocument();
  });

  it("affiche un message lorsqu'aucun vol n'est trouvé", async () => {
    const user = userEvent.setup();

    apiMocks.post.mockResolvedValueOnce([]);

    const view = render(<TicketsPage />);
    await openSearch(user);
    await fillSearch(user, view.container);
    await user.click(
      within(view.container.querySelector("form")!).getByRole("button", {
        name: "Rechercher un vol",
      }),
    );

    expect(await screen.findByText("Aucun vol trouvé")).toBeInTheDocument();
  });

  it("affiche l'erreur du service de recherche", async () => {
    const user = userEvent.setup();

    apiMocks.post.mockRejectedValueOnce(new Error("Service de vols indisponible"));

    const view = render(<TicketsPage />);
    await openSearch(user);
    await fillSearch(user, view.container);
    await user.click(
      within(view.container.querySelector("form")!).getByRole("button", {
        name: "Rechercher un vol",
      }),
    );

    expect(await screen.findByText("Service de vols indisponible")).toBeInTheDocument();
  });

  it("enregistre une offre de vol pour le passager renseigné", async () => {
    const user = userEvent.setup();

    apiMocks.post.mockResolvedValueOnce([offer]).mockResolvedValueOnce({ id: 15 });

    const view = render(<TicketsPage />);
    await openSearch(user);
    await fillSearch(user, view.container);
    await user.click(
      within(view.container.querySelector("form")!).getByRole("button", {
        name: "Rechercher un vol",
      }),
    );

    await user.click(await screen.findByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(apiMocks.post).toHaveBeenCalledWith("/tickets", {
        passengerName: "Kouakou Elie Marc",
        flightNumber: "AF702",
        airline: "Air France",
        origin: "CDG",
        destination: "ABJ",
        departureDate: "2030-01-15T10:30:00.000Z",
        arrivalDate: "2030-01-15T17:30:00.000Z",
        price: 450,
        currency: "EUR",
      });
    });
  });

  it("supprime un billet après confirmation", async () => {
    const user = userEvent.setup();

    apiMocks.get.mockResolvedValueOnce([ticket]);
    vi.stubGlobal("confirm", vi.fn(() => true));

    const view = render(<TicketsPage />);
    await screen.findByText("AF702");

    const card = screen.getByText("AF702").closest(".card")!;
    await user.click(card.querySelector("button")!);

    expect(apiMocks.del).toHaveBeenCalledWith("/tickets/15");
    await waitFor(() => expect(view.container).not.toHaveTextContent("AF702"));
  });
});
