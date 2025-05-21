/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, Command, findOption, sendBotMessage } from "@api/Commands";
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

// Type-safe boolean fallback helper
function getBooleanOption(options: any[], name: string, fallback: boolean): boolean {
    const opt = findOption(options, name);
    if (opt && typeof opt === "object" && "value" in opt && typeof (opt as { value: unknown }).value === "boolean") {
        return (opt as { value: boolean }).value;
    }
    return fallback;
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
            if (!ctx.channel) return;

            const useNSFW = getBooleanOption(options, "nsfw", false);
            const silent = getBooleanOption(options, "silent", true); // fallback is true
            const sort = (findOption(options, "sort") as { value: string } | undefined)?.value ?? settings.store.SortBy;

            logger.log("Command options:", { useNSFW, silent, sort });

            if (useNSFW && settings.store.nsfwWarn && !ctx.channel.nsfw) {
                sendBotMessage(ctx.channel.id, { content: "Cannot send NSFW content in a non-NSFW channel." });
                return;
            }

            const subreddit = useNSFW ? "femboys" : "femboy";
            const url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=100`;

            try {
                const res = await fetch(url);
                const json = await res.json();

                const posts = json.data?.children
                    .map(p => p.data)
                    .filter(p =>
                        typeof p.url_overridden_by_dest === "string" &&
                        /\.(png|jpg|jpeg|gif)$/.test(p.url_overridden_by_dest)
                    );

                if (!posts?.length) {
                    logger.log("No valid posts found in subreddit:", subreddit);
                    sendBotMessage(ctx.channel.id, { content: "No valid image posts found." });
                    return;
                }

                const post = posts[Math.floor(Math.random() * posts.length)];
                const imageUrl = post.url_overridden_by_dest.replace(/\.gifv$/, ".gif");
                const postUrl = `https://reddit.com${post.permalink}`;

                const authorRes = await fetch(`https://www.reddit.com/user/${post.author}/about.json`);
                const authorJson = await authorRes.json();
                const authorIcon = authorJson?.data?.icon_img?.split("?")[0] ?? "https://www.redditstatic.com/avatars/avatar_default_01_24A0A1.png";

                if (silent) {
                    sendBotMessage(ctx.channel.id, {
                        embeds: [{
                            type: "rich",
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
                            color: "16053476", // hex f4b8e4
                            id: crypto.randomUUID(),
                            rawDescription: "",
                            referenceId: null,
                            fields: [] // Required
                        }]
                    });
                } else {
                    // User sends image as plain message
                    sendMessage(ctx.channel.id, { content: imageUrl });
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
    commands: [makeCommand("femboy")]
});
