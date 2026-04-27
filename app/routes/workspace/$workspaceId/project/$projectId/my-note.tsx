import MyNoteLayout from "~/components/workspace/projects/$projectId/my-note/layout/MyNoteLayout";

export function meta() {
    return [{ title: "My Notes · Flux" }];
}

export default function MyNotePage() {
    return <MyNoteLayout />;
}
