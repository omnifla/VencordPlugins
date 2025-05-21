/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
    ApplicationCommandInputType,
    Command,
    findOption,
    sendBotMessage
} from "@api/Commands";
import { definePluginSettings, OptionType } from "@api/Settings";
import { Devs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";

const logger = new Logger("LoveFemboys");

const settings = definePluginSettings({
    nsfwWarn: {
        type: OptionType.BOOLEAN,
        description: "Prevent sending NSFW images in non-NSFW channels.",
        default: true
    },
    SortBy: {
        type: OptionType.STRING,
        description: "Default sorting method for Reddit posts.",
        default: "new"
    }
});

function getBooleanOption(options: any[], name: string, fallback: boolean): boolean {
    const opt = findOption(options, name);
    const val = (opt && typeof opt === "object" && "value" in opt) ? (opt as { value: any }).value : undefined;
    if (val === true || val === "true") return true;
    if (val === false || val === "false") return false;
    return fallback;
}

async function imageExists(url: string): Promise<boolean> {
    try {
        const response = await fetch(url, { method: "HEAD" });
        return (response.ok && response.headers.get("content-type")?.startsWith("image")) ?? false;
    } catch {
        return false;
    }
}

async function getAuthorIcon(authorJson: any): Promise<string> {
    const iconImg = authorJson?.data?.icon_img?.split("?")[0].replace(/&amp;/g, "&") ?? null;
    const snoovatarImg = authorJson?.data?.snoovatar_img?.split("?")[0].replace(/&amp;/g, "&") ?? null;
    const defaultIcon = "https://www.redditstatic.com/avatars/avatar_default_02_7193FF.png";

    if (iconImg && await imageExists(iconImg)) {
        return iconImg;
    } else if (snoovatarImg && await imageExists(snoovatarImg)) {
        return snoovatarImg;
    } else {
        return defaultIcon;
    }
}

function makeCommand(name: string): Command {
    return {
        name,
        description: "Get a post of a femboy from Reddit.",
        inputType: ApplicationCommandInputType.BUILT_IN,
        options: [
            { name: "nsfw", displayName: "NSFW", description: "Use r/femboys (NSFW)", required: false, type: 5 },
            { name: "sort", displayName: "Sort", description: "Sorting method", required: false, type: 3 },
            { name: "silent", displayName: "Silent", description: "Only you can see the result", required: false, type: 5 }
        ],
        async execute(options, ctx) {
            const useNSFW = getBooleanOption(options, "nsfw", false);
            const silent = getBooleanOption(options, "silent", true);
            const sortOption = findOption(options, "sort");
            const sort = sortOption && typeof (sortOption as any).value === "string"
                ? (sortOption as any).value
                : settings.store.SortBy;

            logger.log("Command options:", { useNSFW, silent, sort });

            if (!ctx.channel) return;
            const isNSFWChannel = ctx.channel.nsfw;

            if (useNSFW && settings.store.nsfwWarn && !isNSFWChannel) {
                sendBotMessage(ctx.channel.id, {
                    content: "Cannot send NSFW content in a non-NSFW channel."
                });
                return;
            }

            const subreddit = useNSFW ? "femboys" : "femboy";
            const url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=100`;

            try {
                const res = await fetch(url);
                const json = await res.json();

                const posts = json.data?.children
                    .map((p: any) => p.data)
                    .filter((p: any) =>
                        typeof p.url_overridden_by_dest === "string" &&
                        /\.(png|jpg|jpeg|gif|gifv)$/.test(p.url_overridden_by_dest)
                    );

                if (!posts || posts.length === 0) {
                    sendBotMessage(ctx.channel.id, {
                        content: "No valid posts found. Falling back to default subreddit."
                    });
                    return;
                }

                const post = posts[Math.floor(Math.random() * posts.length)];
                const imageUrl = post.url_overridden_by_dest.replace(/\.gifv$/, ".gif");
                const postUrl = `https://reddit.com${post.permalink}`;

                // Fetch author info for icon
                const authorRes = await fetch(`https://www.reddit.com/user/${post.author}/about.json`);
                const authorJson = await authorRes.json();
                const authorIcon = await getAuthorIcon(authorJson);

                const embed = {
                    type: "rich",
                    title: post.title,
                    rawTitle: post.title,
                    url: postUrl,
                    author: {
                        name: `u/${post.author} • r/${post.subreddit}`,
                        iconURL: authorIcon,
                        iconProxyURL: undefined,
                        url: postUrl
                    },
                    image: {
                        url: imageUrl,
                        proxyURL: imageUrl,
                        height: 0,
                        width: 0
                    },
                    color: "16042180",
                    id: crypto.randomUUID(),
                    rawDescription: "",
                    referenceId: null,
                    fields: [] as []
                };

                if (silent) {
                    logger.log("Sending silently (bot embed only)");
                    sendBotMessage(ctx.channel.id, { embeds: [embed] });
                } else {
                    logger.log("Sending publicly (user post + bot embed)");
                    // User posts image (visible to everyone)
                    sendMessage(ctx.channel.id, { content: imageUrl });
                    // Bot follows with embed (for context)
                    sendBotMessage(ctx.channel.id, { embeds: [embed] });
                }

            } catch (err) {
                logger.error("Error fetching Reddit content:", err);
                sendBotMessage(ctx.channel.id, { content: "Failed to fetch content." });
            }
        }
    };
}

export default definePlugin({
    name: "LoveFemboys",
    description: "Get a post of a femboy from Reddit.",
    authors: [Devs.omnifla],
    settings,
    commands: [makeCommand("femboy")],
    start() {},
    stop() {},
});
