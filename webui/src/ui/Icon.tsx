import { ICONS, type IconName } from "./icons";

interface IconProps {
  name: IconName;
  className?: string;
}

export function Icon({ name, className = "icon" }: IconProps) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 24 24"
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}
