import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const useSiteContent = () => {
  const query = useQuery({
    queryKey: ["site-content"],
    queryFn: api.content.listPublic,
  });

  const contentMap = useMemo(() => {
    return (query.data ?? []).reduce<Record<string, string>>((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {});
  }, [query.data]);

  return { ...query, contentMap };
};
