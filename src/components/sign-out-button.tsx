export default function SignOutButton({
  name,
  color,
}: {
  name: string;
  color: string;
}) {
  return (
    <form action="/auth/signout" method="post" className="shrink-0">
      <button
        type="submit"
        title={`${name} — вийти`}
        className="grid h-9 w-9 place-items-center rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-80"
        style={{ background: color }}
      >
        {name.trim().charAt(0).toUpperCase()}
      </button>
    </form>
  );
}
