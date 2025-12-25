import type { Position } from "../../../lib/positioning";

interface FloatingIconProps {
  position: Position;
  onClick: () => void;
  visible: boolean;
}

export function FloatingIcon({ position, onClick, visible }: FloatingIconProps) {
  if (!visible) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed z-[999999] w-6 h-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all duration-200 ease-in-out transform hover:scale-110 cursor-pointer"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      title="Convert currency"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-full h-full p-1"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v12" />
        <path d="M15 9h-6" />
        <path d="M15 15h-6" />
        <path d="M9 12h6" />
      </svg>
    </button>
  );
}
