import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AccessibleIconButton from "../components/common/AccessibleIconButton";

describe("AccessibleIconButton", () => {
  it("expose le libellé comme nom accessible", () => {
    render(<AccessibleIconButton icon={<span>×</span>} label="Fermer l'aperçu" />);

    expect(
      screen.getByRole("button", { name: "Fermer l'aperçu" }),
    ).toBeInTheDocument();
  });

  it("réutilise le libellé pour l'attribut title", () => {
    render(<AccessibleIconButton icon={<span>×</span>} label="Fermer" />);

    expect(screen.getByRole("button", { name: "Fermer" })).toHaveAttribute(
      "title",
      "Fermer",
    );
  });

  it("affiche l'icône transmise", () => {
    render(
      <AccessibleIconButton
        icon={<span data-testid="icone-fermeture">×</span>}
        label="Fermer"
      />,
    );

    expect(screen.getByTestId("icone-fermeture")).toBeInTheDocument();
  });

  it("transmet la classe et le type du bouton", () => {
    render(
      <AccessibleIconButton
        icon={<span>×</span>}
        label="Fermer"
        className="bouton-fermeture"
        type="button"
      />,
    );

    const button = screen.getByRole("button", { name: "Fermer" });

    expect(button).toHaveClass("bouton-fermeture");
    expect(button).toHaveAttribute("type", "button");
  });

  it("déclenche son action au clic", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <AccessibleIconButton
        icon={<span>×</span>}
        label="Fermer"
        onClick={onClick}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Fermer" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("déclenche son action avec la touche Entrée", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <AccessibleIconButton
        icon={<span>×</span>}
        label="Fermer"
        onClick={onClick}
      />,
    );

    screen.getByRole("button", { name: "Fermer" }).focus();
    await user.keyboard("{Enter}");

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("ne déclenche pas l'action lorsqu'il est désactivé", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <AccessibleIconButton
        icon={<span>×</span>}
        label="Fermer"
        disabled
        onClick={onClick}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Fermer" }));

    expect(onClick).not.toHaveBeenCalled();
  });
});
