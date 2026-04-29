import MyNoteLayout from "~/components/workspace/projects/$projectId/my-note/layout/MyNoteLayout";

export function meta() {
    return [{ title: "Notes · Flux" }];
}

export default function MyNotePage() {
    return <MyNoteLayout />;
}
