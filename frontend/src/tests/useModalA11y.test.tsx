import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useModalA11y } from "../hooks/useModalA11y";

function ModalHarness({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const modalRef = useModalA11y(isOpen, onClose);

  return (
    <>
      <button type="button">Bouton extérieur</button>

      {isOpen && (
        <div ref={modalRef} role="dialog" aria-label="Fenêtre de test">
          <button type="button">Première action</button>
          <button type="button">Dernière action</button>
        </div>
      )}
    </>
  );
}

describe("useModalA11y", () => {
  it("rend la modale focalisable avec tabindex=-1", () => {
    render(<ModalHarness isOpen onClose={vi.fn()} />);

    expect(screen.getByRole("dialog")).toHaveAttribute("tabindex", "-1");
  });

  it("place le focus sur la modale à l'ouverture", () => {
    render(<ModalHarness isOpen onClose={vi.fn()} />);

    expect(screen.getByRole("dialog")).toHaveFocus();
  });

  it("appelle onClose lorsque la touche Échap est pressée", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<ModalHarness isOpen onClose={onClose} />);
    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ramène le focus au premier bouton après Tab sur le dernier", async () => {
    const user = userEvent.setup();

    render(<ModalHarness isOpen onClose={vi.fn()} />);

    screen.getByRole("button", { name: "Dernière action" }).focus();
    await user.keyboard("{Tab}");

    expect(screen.getByRole("button", { name: "Première action" })).toHaveFocus();
  });

  it("ramène le focus au dernier bouton après Maj+Tab sur le premier", async () => {
    const user = userEvent.setup();

    render(<ModalHarness isOpen onClose={vi.fn()} />);

    screen.getByRole("button", { name: "Première action" }).focus();
    await user.keyboard("{Shift>}{Tab}{/Shift}");

    expect(screen.getByRole("button", { name: "Dernière action" })).toHaveFocus();
  });

  it("restaure le focus précédent après la fermeture", () => {
    const onClose = vi.fn();
    const view = render(<ModalHarness isOpen={false} onClose={onClose} />);
    const outsideButton = screen.getByRole("button", { name: "Bouton extérieur" });

    outsideButton.focus();
    view.rerender(<ModalHarness isOpen onClose={onClose} />);
    view.rerender(<ModalHarness isOpen={false} onClose={onClose} />);

    expect(outsideButton).toHaveFocus();
  });

  it("utilise la dernière fonction de fermeture reçue", async () => {
    const user = userEvent.setup();
    const firstClose = vi.fn();
    const latestClose = vi.fn();
    const view = render(<ModalHarness isOpen onClose={firstClose} />);

    view.rerender(<ModalHarness isOpen onClose={latestClose} />);
    await user.keyboard("{Escape}");

    expect(firstClose).not.toHaveBeenCalled();
    expect(latestClose).toHaveBeenCalledTimes(1);
  });

  it("ignore Échap lorsque la modale est fermée", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<ModalHarness isOpen={false} onClose={onClose} />);
    await user.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
  });
});
