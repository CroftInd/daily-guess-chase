import {redirect} from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function ukDate(){
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}

export default function Home(){
  redirect(`/day/${ukDate()}`);
}
