import Link from "next/link";
import { CreateTopicForm } from "@/components/CreateTopicForm";

export default function NewTopicPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <Link
          href="/topics"
          className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
        >
          ← Topics
        </Link>
        <h1 className="text-xl font-semibold">New topic</h1>
      </div>
      <CreateTopicForm />
    </div>
  );
}
