import icon from "../../../assets/icon.svg";
import { useFloating } from "@floating-ui/react-dom";
import { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

type FloatingIconProps = ButtonProps &
  Required<Pick<ButtonProps, "onClick">> &
  Pick<ReturnType<typeof useFloating>["refs"], "setFloating"> &
  Pick<ReturnType<typeof useFloating>, "floatingStyles">;

export function FloatingIcon({
  onClick,
  setFloating,
  floatingStyles,
}: FloatingIconProps) {
  return (
    <button
      type="button"
      ref={setFloating}
      onClick={onClick}
      className="fixed w-12 h-12 bg-white text-blue-600 rounded-sm shadow-lg transition-all duration-200 ease-in-out transform hover:scale-110 cursor-pointer p-2"
      style={floatingStyles}
      title="Convert currency"
    >
      <img src={icon} alt="Currency Lens Icon" className="m-auto" />
    </button>
  );
}
