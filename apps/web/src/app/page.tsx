import { redirect } from "next/navigation";

// Root page redirects to the trips dashboard
export default function HomePage() {
  redirect("/trips");
}
