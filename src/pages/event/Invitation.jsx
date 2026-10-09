import { Lock } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { EmptyState } from "../../components/Page.jsx";
import InvitationEditor from "../../components/InvitationEditor.jsx";

export default function Invitation() {
  const { event, setEvent } = useOutletContext();
  if (event.status !== "active") {
    return (
      <EmptyState icon={Lock} title="The invitation is locked" body="It can’t be changed after the event has ended. Guests who open their invite now see that the event is over." />
    );
  }
  return <InvitationEditor event={event} onSaved={setEvent} />;
}
