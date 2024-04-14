import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";
import { HarmBlockThreshold, HarmCategory } from "https://esm.run/@google/generative-ai";


const version = "0.5";

//inputs
const ApiKeyInput = document.querySelector("#apiKeyInput");
const maxTokensInput = document.querySelector("#maxTokens");
const messageInput = document.querySelector("#messageInput");

//forms
const addPersonalityForm = document.querySelector("#form-add-personality");
const editPersonalityForm = document.querySelector("#form-edit-personality");

//buttons
const sendMessageButton = document.querySelector("#btn-send");
const clearAllButton = document.querySelector("#btn-clearall-personality");
const whatsNewButton = document.querySelector("#btn-whatsnew");
const submitNewPersonalityButton = document.querySelector("#btn-submit-personality");
const importPersonalityButton = document.querySelector("#btn-import-personality");
const addPersonalityButton = document.querySelector("#btn-add-personality");
const hideOverlayButton = document.querySelector("#btn-hide-overlay");
const submitPersonalityEditButton = document.querySelector("#btn-submit-personality-edit");
const hideSidebarButton = document.querySelector("#btn-hide-sidebar");
const showSidebarButton = document.querySelector("#btn-show-sidebar");
const deleteAllChatsButton = document.querySelector("#btn-reset-chat");
const newChatButton = document.querySelector("#btn-new-chat");

//containers
const sidebar = document.querySelector(".sidebar");
const messageContainer = document.querySelector(".message-container");
const personalityCards = document.getElementsByClassName("card-personality");
const formsOverlay = document.querySelector(".overlay");
const sidebarViews = document.getElementsByClassName("sidebar-section");
const defaultPersonalityCard = document.querySelector("#card-personality-default");
const chatHistorySection = document.querySelector("#chatHistorySection");

//nav elements
const tabs = document.getElementsByClassName("navbar-tab");
const tabHighlight = document.querySelector(".navbar-tab-highlight");

//misc
const badge = document.querySelector("#btn-whatsnew");

//-------------------------------

//load api key from local storage into input field
ApiKeyInput.value = localStorage.getItem("API_KEY");
maxTokensInput.value = localStorage.getItem("maxTokens");
if (maxTokensInput.value == "") maxTokensInput.value = 1000;

//define AI settings
const safetySettings = [

    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },

];
const systemPrompt = "If needed, format your answer using markdown." +
    "Today's date is" + new Date().toDateString() + "." +
    "End of system prompt.";

//setup tabs
let currentTab = undefined;
tabHighlight.style.width = `calc(100% / ${tabs.length})`;
[...tabs].forEach(tab => {
    tab.addEventListener("click", () => {
        navigateTo(tab);
    })
});

[...sidebarViews].forEach(view => {
    hideElement(view);
});

navigateTo(tabs[0]);

//load personalities on launch
const personalitiesArray = JSON.parse(getLocalPersonalities());
if (personalitiesArray) {
    for (let personality of personalitiesArray) {
        insertPersonality(personality);
    }
}
let personalityToEditIndex = 0;

//add default personality card event listeners and initial state
const shareButton = defaultPersonalityCard.querySelector(".btn-share-card");
const editButton = defaultPersonalityCard.querySelector(".btn-edit-card");
const input = defaultPersonalityCard.querySelector("input");

shareButton.addEventListener("click", () => {
    sharePersonality(defaultPersonalityCard);
}
);

editButton.addEventListener("click", () => {
    alert("You cannot edit the default personality card.");
    return;
});

input.addEventListener("change", () => {
    // Darken all cards
    [...personalityCards].forEach(card => {
        card.style.outline = "0px solid rgb(150 203 236)";
        darkenBg(card);
    })
    // Lighten selected card
    input.parentElement.style.outline = "3px solid rgb(150 203 236)";
    lightenBg(input.parentElement);
});

if (input.checked) {
    lightenBg(input.parentElement);
    input.parentElement.style.outline = "3px solid rgb(150 203 236)";
}

//setup version number on badge and header
badge.querySelector("#badge-version").textContent = `v${version}`;
document.getElementById('header-version').textContent += ` v${version}`;

//show whats new on launch if new version
const prevVersion = localStorage.getItem("version");
if (prevVersion != version) {
    localStorage.setItem("version", version);
    badge.classList.add("badge-highlight");
    setTimeout(() => {
        badge.classList.remove("badge-highlight");
    }, 7000);
}

//indexedDB setup
let db = new Dexie("chatDB");
let currentChat;
db.version(3).stores({
    chats: `
        ++id,
        title,
        timestamp,
        content`,
});


//get all chats and load them in the template
let chats = await getAllChatIdentifiers();
for (let chat of chats) {
    const chatElement = document.createElement("input");
    chatElement.setAttribute("type", "radio");
    chatElement.setAttribute("name", "currentChat");
    chatElement.setAttribute("value", "chat" + chat.id);
    chatElement.id = "chat" + chat.id;
    chatElement.classList.add("input-radio-currentchat");
    chatHistorySection.append(chatElement);

    const chatLabel = document.createElement("label");
    chatLabel.setAttribute("for", "chat" + chat.id);
    chatLabel.textContent = chat.title;
    chatLabel.classList.add("title-chat");

    const historyEntry = document.createElement("div");
    historyEntry.classList.add("label-currentchat");

    const chatIcon = document.createElement("span");
    chatIcon.classList.add("material-symbols-outlined");
    chatIcon.innerHTML = "chat_bubble";

    historyEntry.append(chatIcon);
    historyEntry.append(chatLabel);

    chatHistorySection.append(historyEntry);
    //
    historyEntry.addEventListener("click", async () => { await onChatSelect(chat.id, chatElement); });
}


//event listeners
hideOverlayButton.addEventListener("click", closeOverlay);

addPersonalityButton.addEventListener("click", showAddPersonalityForm);

submitNewPersonalityButton.addEventListener("click", submitNewPersonality);

submitPersonalityEditButton.addEventListener("click", () => { submitPersonalityEdit(personalityToEditIndex) });

sendMessageButton.addEventListener("click", run);

newChatButton.addEventListener("click", () => {
    if (!currentChat) {
        return
    }
    currentChat = null;
    messageContainer.innerHTML = "";
    document.querySelector("input[name='currentChat']:checked").checked = false;
});

//enter key to send message but support shift+enter for new line
messageInput.addEventListener("keydown", (e) => {
    if (e.key == "Enter" && !e.shiftKey) {
        e.preventDefault();
        run();
    }
});

whatsNewButton.addEventListener("click", showWhatsNew);

hideSidebarButton.addEventListener("click", () => {
    hideElement(sidebar);
});

showSidebarButton.addEventListener("click", () => {
    showElement(sidebar);
});

clearAllButton.addEventListener("click", () => {
    localStorage.removeItem("personalities");
    [...personalityCards].forEach(card => {
        if (card != defaultPersonalityCard) {
            card.remove();
        }
    });
});

deleteAllChatsButton.addEventListener("click", deleteAllChats);

importPersonalityButton.addEventListener("click", () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = function (e) {
            const personalityJSON = JSON.parse(e.target.result);
            insertPersonality(personalityJSON);
            setLocalPersonality(personalityJSON);
        };
        reader.readAsText(file);
    });
    fileInput.click();
    fileInput.remove();
});

window.addEventListener("resize", () => {
    //show sidebar if window is resized to desktop size
    if (window.innerWidth > 768) {
        showElement(document.querySelector(".sidebar"));
    }
});

messageInput.addEventListener("input", () => {
    //auto resize message input
    if (messageInput.value.split("\n").length == 1) {
        messageInput.style.height = "2.5rem";
    }
    else {
        messageInput.style.height = "";
        messageInput.style.height = messageInput.scrollHeight + "px";
    }
});

//-------------------------------

//functions
function hideElement(element) {
    element.style.transition = 'opacity 0.2s';
    element.style.opacity = '0';
    setTimeout(function () {
        element.style.display = 'none';
    }, 200);
}

function showElement(element) {
    // Wait for other transitions to complete (0.2s delay)
    setTimeout(function () {
        // Change display property
        element.style.display = 'flex';
        // Wait for next frame for display change to take effect
        requestAnimationFrame(function () {
            // Start opacity transition
            element.style.transition = 'opacity 0.2s';
            element.style.opacity = '1';
        });
    }, 200);
}

function darkenBg(element) {
    let elementBackgroundImageURL = element.style.backgroundImage.match(/url\((.*?)\)/)[1].replace(/('|")/g, '');
    element.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url('${elementBackgroundImageURL}')`;
}


function lightenBg(element) {

    let elementBackgroundImageURL = element.style.backgroundImage.match(/url\((.*?)\)/)[1].replace(/('|")/g, '');
    element.style.backgroundImage = `url('${elementBackgroundImageURL}')`;
}


function navigateTo(tab) {
    if (tab == tabs[currentTab]) {
        return;
    }
    tab.classList.add("navbar-tab-active");

    // set the highlight to match the size of the tab element
    let tabIndex = [...tabs].indexOf(tab);
    if (tabIndex < 0 || tabIndex >= sidebarViews.length) {
        console.error("Invalid tab index: " + tabIndex);
        return;
    }

    if (currentTab != undefined) {
        hideElement(sidebarViews[currentTab]);
        tabs[currentTab].classList.remove("navbar-tab-active");
    }
    showElement(sidebarViews[tabIndex]);
    currentTab = tabIndex;


    tabHighlight.style.left = `calc(100% / ${tabs.length} * ${tabIndex})`;

}

async function getAllChatIdentifiers() {
    try {
        let identifiers = [];
        await db.chats.orderBy('timestamp').each(
            chat => {
                identifiers.push({ id: chat.id, title: chat.title });
            }
        )
        identifiers.reverse();
        return identifiers;
    } catch (error) {
        //to be implemented
        console.log(error);
    }
}


async function getAllChats() {
    try {
        const chats = await db.chats.orderBy('timestamp').toArray(); // Get all objects
        chats.reverse() //reverse in order to have the latest chat at the top
        return chats;
    } catch (error) {
        console.error("Error getting titles:", error);
        throw error;
    }
}

async function getChatById(id) {
    try {
        const chat = await db.chats.get(id);
        return chat;
    } catch (error) {
        console.log(error);
    }
}

async function onChatSelect(chatID, inputElement) {
    try {
        messageContainer.innerHTML = "";
        let chat = await getChatById(chatID);
        for await (let msg of chat.content) {
            await insertMessage(msg.role, msg.txt, msg.personality);
        }
        currentChat = chatID;
        inputElement.click();
    } catch (error) {
        console.error(error);
    }
}

async function deleteAllChats() {
    try {
        await db.chats.clear();
        messageContainer.innerHTML = "";
        chatHistorySection.innerHTML = "";
        currentChat = "";
    }
    catch (error) {
        console.error("error deleting chats: ", error);
    }
}


async function addChatHistory(title, firstMessage = null) {
    try {
        const id = await db.chats.put({
            title: title,
            timestamp: Date.now(),
            content: firstMessage ? [{ role: "user", txt: firstMessage }] : []
        });

        const chatLabel = document.createElement("label");
        chatLabel.setAttribute("for", "chat" + id);
        chatLabel.classList.add("title-chat");
        chatLabel.textContent = title;

        const historyEntry = document.createElement("div");
        historyEntry.classList.add("label-currentchat");

        const chatIcon = document.createElement("span");
        chatIcon.classList.add("material-symbols-outlined");
        chatIcon.innerHTML = "chat_bubble";

        historyEntry.append(chatIcon);
        historyEntry.append(chatLabel);

        chatHistorySection.prepend(historyEntry);

        const chatElement = document.createElement("input");
        chatElement.setAttribute("type", "radio");
        chatElement.setAttribute("name", "currentChat");
        chatElement.setAttribute("value", "chat" + id);
        chatElement.id = "chat" + id;
        chatElement.classList.add("input-radio-currentchat");
        chatHistorySection.prepend(chatElement);
        //
        historyEntry.addEventListener("click", async () => { await onChatSelect(id, chatElement); });
        return id
    } catch (error) {
        console.error(error);
    }
}

function sharePersonality(personality) {
    //export personality to json
    const personalityJSON = {
        name: personality.querySelector(".personality-title").innerText,
        description: personality.querySelector(".personality-description").innerText,
        prompt: personality.querySelector(".personality-prompt").innerText,
        //base64 encode image
        image: personality.style.backgroundImage.match(/url\((.*?)\)/)[1].replace(/('|")/g, '')
    }
    const personalityJSONString = JSON.stringify(personalityJSON);
    //download
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(personalityJSONString));
    element.setAttribute('download', `${personalityJSON.name}.json`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}


function showAddPersonalityForm() {
    showElement(formsOverlay);
    showElement(addPersonalityForm);
}

function showEditPersonalityForm() {
    showElement(formsOverlay);
    showElement(editPersonalityForm);
}

function closeOverlay() {
    hideElement(formsOverlay);
    hideElement(addPersonalityForm);
    hideElement(editPersonalityForm);
    hideElement(document.querySelector("#whats-new"));
}


function insertPersonality(personalityJSON) {
    const personalitiesDiv = document.querySelector("#personalitiesDiv");
    const personalityCard = document.createElement("label");

    personalityCard.classList.add("card-personality");
    personalityCard.style.backgroundImage = `url('${personalityJSON.image}')`;
    personalityCard.innerHTML = `
            <input type="radio" name="personality" value="${personalityJSON.name}">
            <div>
                <h3 class="personality-title">${personalityJSON.name}</h3>
                <p class="personality-description">${personalityJSON.description}</p>
                <p class="personality-prompt">${personalityJSON.prompt}</p>
            </div>
            <button class="btn-textual btn-edit-card material-symbols-outlined" 
                id="btn-edit-personality-${personalityJSON.name}">edit</button>
            <button class="btn-textual btn-share-card material-symbols-outlined" 
                id="btn-share-personality-${personalityJSON.name}">share</button>
            <button class="btn-textual btn-delete-card material-symbols-outlined"
                id="btn-delete-personality-${personalityJSON.name}">delete</button>
            `;

    //insert personality card before the button array
    personalitiesDiv.append(personalityCard);
    darkenBg(personalityCard);

    const shareButton = personalityCard.querySelector(".btn-share-card");
    const deleteButton = personalityCard.querySelector(".btn-delete-card");
    const editButton = personalityCard.querySelector(".btn-edit-card");
    const input = personalityCard.querySelector("input");

    shareButton.addEventListener("click", () => {
        sharePersonality(personalityCard);
    });

    //conditional because the default personality card doesn't have a delete button
    if (deleteButton) {
        deleteButton.addEventListener("click", () => {
            deleteLocalPersonality(Array.prototype.indexOf.call(personalityCard.parentNode.children, personalityCard));
            personalityCard.remove();
        });
    }

    editButton.addEventListener("click", () => {
        personalityToEditIndex = Array.prototype.indexOf.call(personalityCard.parentNode.children, personalityCard);
        showEditPersonalityForm();
        const personalityName = personalityCard.querySelector(".personality-title").innerText;
        const personalityDescription = personalityCard.querySelector(".personality-description").innerText;
        const personalityPrompt = personalityCard.querySelector(".personality-prompt").innerText;
        const personalityImageURL = personalityCard.style.backgroundImage.match(/url\((.*?)\)/)[1].replace(/('|")/g, '');
        document.querySelector("#form-edit-personality #personalityNameInput").value = personalityName;
        document.querySelector("#form-edit-personality #personalityDescriptionInput").value = personalityDescription;
        document.querySelector("#form-edit-personality #personalityPromptInput").value = personalityPrompt;
        document.querySelector("#form-edit-personality #personalityImageURLInput").value = personalityImageURL;
    });

    input.addEventListener("change", () => {
        // Darken all cards
        [...personalityCards].forEach(card => {
            card.style.outline = "0px solid rgb(150 203 236)";
            darkenBg(card);
        })
        // Lighten selected card
        input.parentElement.style.outline = "3px solid rgb(150 203 236)";
        lightenBg(input.parentElement);
    });

    // Set initial outline
    if (input.checked) {
        lightenBg(input.parentElement);
        input.parentElement.style.outline = "3px solid rgb(150 203 236)";
    }
}

function setLocalPersonality(personalityJSON) {
    const savedPersonalities = JSON.parse(localStorage.getItem("personalities"));
    let newSavedPersonalities = [];
    if (savedPersonalities) {
        newSavedPersonalities = [...savedPersonalities, personalityJSON];
    }
    else {
        newSavedPersonalities = [personalityJSON];
    }
    localStorage.setItem("personalities", JSON.stringify(newSavedPersonalities));
}

function submitNewPersonality() {
    const personalityName = document.querySelector("#form-add-personality #personalityNameInput");
    const personalityDescription = document.querySelector("#form-add-personality #personalityDescriptionInput");
    const personalityImageURL = document.querySelector("#form-add-personality #personalityImageURLInput");
    const personalityPrompt = document.querySelector("#form-add-personality #personalityPromptInput");

    if (personalityName.value == "") {
        alert("Please enter a personality name");
        return;
    }
    if (personalityPrompt.value == "") {
        alert("Please enter a personality prompt");
        return;
    }

    //to json
    const personalityJSON = {
        name: personalityName.value,
        description: personalityDescription.value,
        prompt: personalityPrompt.value,
        image: personalityImageURL.value
    }
    insertPersonality(personalityJSON);
    setLocalPersonality(personalityJSON);
    closeOverlay();
}

function submitPersonalityEdit(personalityIndex) {
    const newName = editPersonalityForm.querySelector("#personalityNameInput").value;
    const newDescription = editPersonalityForm.querySelector("#personalityDescriptionInput").value;
    const newPrompt = editPersonalityForm.querySelector("#personalityPromptInput").value;
    const newImageURL = editPersonalityForm.querySelector("#personalityImageURLInput").value;

    if (newName.value == "") {
        alert("Please enter a personality name");
        return;
    }
    if (newPrompt.value == "") {
        alert("Please enter a personality prompt");
        return;
    }

    const personalityCard = [...personalityCards][personalityIndex + 1]; //+1 because the default personality card is not in the array
    personalityCard.querySelector(".personality-title").innerText = newName;
    personalityCard.querySelector(".personality-description").innerText = newDescription;
    personalityCard.querySelector(".personality-prompt").innerText = newPrompt;
    personalityCard.style.backgroundImage = `url('${newImageURL}')`;
    darkenBg(personalityCard);

    const personalitiesJSON = JSON.parse(getLocalPersonalities());
    personalitiesJSON[personalityIndex] = {
        name: newName,
        description: newDescription,
        prompt: newPrompt,
        image: newImageURL
    };
    localStorage.setItem("personalities", JSON.stringify(personalitiesJSON));
    closeOverlay();
}

function getLocalPersonalities() {
    const personalitiesJSON = localStorage.getItem("personalities");
    return personalitiesJSON;
}

function deleteLocalPersonality(index) {
    let localPers = JSON.parse(getLocalPersonalities());
    localPers.splice(index, 1);
    localStorage.setItem("personalities", JSON.stringify(localPers));
}

function getSanitized(string) {
    return DOMPurify.sanitize(string.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim());
}

function showWhatsNew() {
    const whatsNewDiv = document.querySelector("#whats-new");
    showElement(formsOverlay);
    showElement(whatsNewDiv);
}

async function insertMessage(sender, msgText, selectedPersonalityTitle = null, netStream = null) {
    //create new message div for the user's message then append to message container's top
    const newMessage = document.createElement("div");
    newMessage.classList.add("message");
    messageContainer.insertBefore(newMessage, messageContainer.firstChild);
    let messageRole;
    //handle model's message
    if (sender != "user") {
        newMessage.classList.add("message-model");
        messageRole = selectedPersonalityTitle;
        newMessage.innerHTML = `
            <h3 class="message-role">${messageRole}</h3>
            <div class="message-role-api" style="display: none;">${sender}</div>
            <p class="message-text"></p>
            `;
        const messageContent = newMessage.querySelector(".message-text");
        //no streaming necessary if not receiving answer
        if (!netStream) {
            messageContent.innerHTML = msgText;
        }
        else {
            let rawText = "";
            for await (const chunk of netStream.stream) {
                try {
                    rawText += chunk.text();
                    messageContent.innerHTML = marked.parse(rawText);

                } catch (error) {
                    alert("Error, please report this to the developer. You might need to restart the page to continue normal usage. Error: " + error);
                    console.error(error);
                }
            }
            hljs.highlightAll();
            return messageContent.innerHTML;

        }
    }
    else {
        messageRole = "You:";
        newMessage.innerHTML = `
                <h3 class="message-role">${messageRole}</h3>
                <div class="message-role-api" style="display: none;">${sender}</div>
                <p class="message-text">${msgText}</p>
                `;
    }
}

async function run() {
    const msg = document.querySelector("#messageInput");
    const selectedPersonalityTitle = document.querySelector("input[name='personality']:checked + div .personality-title").innerText;
    const selectedPersonalityDescription = document.querySelector("input[name='personality']:checked + div .personality-description").innerText;
    const selectedPersonalityPrompt = document.querySelector("input[name='personality']:checked + div .personality-prompt").innerText;
    const messageElements = messageContainer.querySelectorAll(".message");
    const selectedPersonalityToneExamples = [];


    if (!ApiKeyInput.value) {
        alert("Please enter an API key");
        return;
    }

    let msgText = getSanitized(msg.value);
    if (!msgText) {
        return;
    }
    const genAI = new GoogleGenerativeAI(ApiKeyInput.value);
    const model = genAI.getGenerativeModel({ model: "gemini-pro", safetySettings });
    
    //we need reversed chat history so the order is correct
    let chatHistory = [];
    messageElements.forEach(element => {
        const messageroleapi = element.querySelector(".message-role-api").innerText;
        const messagetext = element.querySelector(".message-text").innerText;
        chatHistory.push({
            role: messageroleapi,
            parts: [{ text: messagetext }]
        })
    });
    chatHistory.reverse();


    //user msg handling
    await insertMessage("user", msgText);
    msg.value = "";
    document.getElementById('messageInput').style.height = "2.5rem"; //This will reset messageInput box to its normal size.
    if (!currentChat) {
        const result = await model.generateContent('Please generate a short title for the following request from a user: ' + msgText);
        const title = (await result.response).text();
        currentChat = await addChatHistory(title, msgText);
        document.querySelector(`#chat${currentChat}`).click();
    }
    else {
        const currentChatHistory = await getChatById(currentChat);
        currentChatHistory.content.push({ role: "user", txt: msgText });
        await db.chats.put(currentChatHistory);
    }


    //model msg handling
    const generationConfig = {
        maxOutputTokens: maxTokensInput.value,
        temperature: 0.9
    };
    const chat = await model.startChat({
        generationConfig, safetySettings,
        history: [
            {
                role: "user",
                parts: [{ text: `Personality Name: ${selectedPersonalityTitle}, Personality Description: ${selectedPersonalityDescription}, Personality Prompt: ${selectedPersonalityPrompt}. ${systemPrompt}` }]
            },
            {
                role: "model",
                parts: [{ text: `Okay. From now on, I shall play the role of ${selectedPersonalityTitle}. Your prompt and described personality will be used for the rest of the conversation.` }]
            },
            ...selectedPersonalityToneExamples,
            ...chatHistory
        ]
    });
    const stream = await chat.sendMessageStream(msgText);
    const replyHTML = await insertMessage("model", "", selectedPersonalityTitle, stream);
    const currentChatHistory = await getChatById(currentChat);
    currentChatHistory.content.push({ role: "model", personality: selectedPersonalityTitle, txt: replyHTML });
    //this replaces the existing chat history in the DB
    await db.chats.put(currentChatHistory);

    //save api key to local storage
    localStorage.setItem("API_KEY", ApiKeyInput.value);
    localStorage.setItem("maxTokens", maxTokensInput.value);
}

//-------------------------------