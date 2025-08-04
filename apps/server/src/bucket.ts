import { OxrLatestResponse } from "@cl/oxr/schema";
import { getTimestamp } from "./time";

const prefix = "latest";

export async function putOxrLatestResponse(data: OxrLatestResponse, env: CloudflareBindings) {
    const timestamp = getTimestamp(new Date(data.timestamp * 1000));

    const key = `${prefix}/${timestamp}/${data.base}.json`;

    return env.DATA_BUCKET.put(key, JSON.stringify(data), {
        customMetadata: {
            type: prefix,
            timestamp: timestamp.toString(),
            base: data.base,
        }
    });
}

export async function getLatestOxrResponseByDate(date: Date, env: CloudflareBindings): Promise<R2ObjectBody | null> {
    const timestamp = getTimestamp(date);

    const list = await env.DATA_BUCKET.list({
        limit: 1,
        prefix: `${prefix}/${timestamp}`,
        include: ["customMetadata"],
    });
    if (list.objects.length === 0) {
        return null;
    }

    const object = list.objects[0];

    const body = await env.DATA_BUCKET.get(object.key);
    if (!body) {
        return null;
    }

    return body;
}

export async function getLatestOxrResponseList(env: CloudflareBindings): Promise<R2Objects> {
    const options: R2ListOptions = {
        prefix: `${prefix}`,
        include: ["customMetadata"],
    };

    const list = await env.DATA_BUCKET.list(options);

    let truncated = list.truncated;
    let cursor = list.truncated ? list.cursor : undefined;

    while (truncated) {
        const next = await env.DATA_BUCKET.list({
            ...options,
            cursor,
        });
        list.objects.push(...next.objects);

        truncated = next.truncated;
        cursor = next.truncated ? next.cursor : undefined;
    }

    return list;
}