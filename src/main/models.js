export default {
    'gpt-oss:120b-cloud': {
        size: "Cloud",
        context: 128,
        tokenizer: "cl100k_base"
    },
    'gpt-oss:20b-cloud': {
        size: "Cloud",
        context: 128,
        tokenizer: "cl100k_base"
    },
    'deepseek-v3.1:671b-cloud': {
        size: "Cloud",
        context: 160,
        tokenizer: "cl100k_base"
    },
    'qwen3-coder:480b-cloud': {
        size: "Cloud",
        context: 256,
        tokenizer: "o200k_base"
    },
    'qwen3-vl:235b-cloud': {
        size: "Cloud",
        context: 256,
        tokenizer: "o200k_base"
    },
    'minimax-m2:cloud': {
        size: "Cloud",
        context: 200,
        tokenizer: "o200k_base"
    },
    'glm-4.6:cloud': {
        size: "Cloud",
        context: 198,
        tokenizer: "cl100k_base"
    },
    'qwen3-coder:30b': {
        size: "19GB",
        context: 256,
        tokenizer: "o200k_base"
    },
    'qwen3-vl:30b': {
        size: "20GB",
        context: 256,
        tokenizer: "o200k_base"
    },
    'qwen3-vl:4b': {
        size: "3.3GB",
        context: 256,
        tokenizer: "o200k_base"
    },
    'qwen3:30b': {
        size: "19GB",
        context: 256,
        tokenizer: "o200k_base"
    },
    'qwen3:8b': {
        size: "5.2GB",
        context: 40,
        tokenizer: "cl100k_base"
    },
    'qwen3:4b': {
        size: "2.5GB",
        context: 256,
        tokenizer: "cl100k_base"
    },
    'llama3.1:8b': {
        size: "4.9GB",
        context: 128,
        tokenizer: "cl100k_base"
    },
    'llama3.2:3b': {
        size: "2.0GB",
        context: 128,
        tokenizer: "cl100k_base"
    },
    // use this as the summarizer for chats
    'llama3.2:1b': {
        size: "1.3GB",
        context: 128,
        summarizer: true,
        tokenizer: "cl100k_base"
    },
    'deepseek-r1:8b': {
        size: "5.2GB",
        context: 128,
        tokenizer: "cl100k_base"
    },
    // turns out this deepseek kind of sucks
    // // use this as the summarizer for chats
    // 'deepseek-r1:1.5b': {
    //     size: "1.1GB",
    //     context: 128,
    //     summarizer: true
    // },
    'tinyllama:1.1b': {
        size: "638MB",
        context: 2,
        tokenizer: "r50k_base"
    },
}