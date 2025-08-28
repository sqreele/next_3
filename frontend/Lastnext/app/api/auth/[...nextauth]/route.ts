// Removed NextAuth route handler as we are migrating away from next-auth
export async function GET() {
  return new Response(JSON.stringify({ message: "Auth route disabled" }), {
    status: 410,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST() {
  return new Response(JSON.stringify({ message: "Auth route disabled" }), {
    status: 410,
    headers: { "Content-Type": "application/json" },
  });
}