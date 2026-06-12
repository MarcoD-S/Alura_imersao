let cardContainer = document.querySelector(".card-container");
let searchInput = document.querySelector("input");
let modalOverlay = document.querySelector("#modal-overlay");
let modalContent = document.querySelector("#modal-content");
let modalCloseBtn = document.querySelector("#modal-close-btn");
let categoryFilter = document.querySelector("#category-filter");
let famousFilterBtn = document.querySelector("#famous-filter-btn");
let sortBtn = document.querySelector("#sort-btn");
let activeTimers = []; // Armazena os IDs dos intervalos dos contadores

let allGames = []; // Armazena todos os jogos carregados do JSON

// Define os possíveis estados de ordenação e o estado atual
const sortStates = ["Padrão", "A-Z", "Z-A", "Mais Recentes", "Mais Antigos"];
let currentSortIndex = 0;


// Carrega os dados do JSON e renderiza todos os cards inicialmente.
// Isso acontece uma vez quando o script é carregado.
async function carregarDados() {
    // Limpa contadores antigos antes de carregar novos dados
    activeTimers.forEach(timerId => clearInterval(timerId));
    activeTimers = [];

    let resposta = await fetch("data.json");
    allGames = await resposta.json();
    renderizarCards(allGames);
    popularCategorias();
}

function popularCategorias() {
    const categorias = new Set(); // Usar um Set para evitar categorias duplicadas
    allGames.forEach(jogo => {
        jogo.categorias.forEach(categoria => categorias.add(categoria));
    });

    // Ordena as categorias em ordem alfabética
    const categoriasOrdenadas = Array.from(categorias).sort();

    categoriasOrdenadas.forEach(categoria => {
        const option = document.createElement('option');
        option.value = categoria;
        option.textContent = categoria;
        categoryFilter.appendChild(option);
    });
}

function aplicarFiltros() {
    let jogosFiltrados = [...allGames]; // Começa com todos os jogos
    const termoBusca = searchInput.value.toLowerCase();
    const categoriaSelecionada = categoryFilter.value;
    const maisFamososAtivo = famousFilterBtn.classList.contains('active');

    // 1. Filtro por "Mais Famosos"
    if (maisFamososAtivo) {
        jogosFiltrados = jogosFiltrados.filter(jogo => jogo.famoso);
    }

    // 2. Filtro por Categoria
    if (categoriaSelecionada !== 'todos') {
        jogosFiltrados = jogosFiltrados.filter(jogo => jogo.categorias.includes(categoriaSelecionada));
    }

    // 3. Filtro por Barra de Busca
    if (termoBusca) {
        jogosFiltrados = jogosFiltrados.filter(jogo =>
            jogo.nome.toLowerCase().includes(termoBusca) ||
            jogo.descricao.toLowerCase().includes(termoBusca)
        );
    }

    // 4. Ordenação
    const sortOrder = sortStates[currentSortIndex];
    if (sortOrder === "A-Z") {
        jogosFiltrados.sort((a, b) => a.nome.localeCompare(b.nome));
    } else if (sortOrder === "Z-A") {
        jogosFiltrados.sort((a, b) => b.nome.localeCompare(a.nome));
    } else if (sortOrder === "Mais Recentes") {
        jogosFiltrados.sort((a, b) => b.ano - a.ano);
    } else if (sortOrder === "Mais Antigos") {
        jogosFiltrados.sort((a, b) => a.ano - b.ano);
    }
    // Se for "Padrão", não faz nada, mantendo a ordem do JSON (ou dos filtros aplicados)

    renderizarCards(jogosFiltrados);
    iniciarContadores(); // Inicia os contadores após renderizar
}

function iniciarBusca() {
    aplicarFiltros();
}

function renderizarCards(cardsParaRenderizar) {
    // Limpa contadores antigos antes de renderizar novos cards
    activeTimers.forEach(timerId => clearInterval(timerId));
    activeTimers = [];
    // Limpa o container de cards antes de adicionar os novos
    cardContainer.innerHTML = "";

    for (let dado of cardsParaRenderizar) {
        const pricesHTML = gerarPrecosHTML(dado);

        let article = document.createElement("article");
        article.innerHTML = `
            <img src="${dado.imagem}" alt="Imagem do jogo ${dado.nome}">
            <div class="card-content">
                <h2>${dado.nome}</h2>
                <p>${dado.descricao}</p>
                ${pricesHTML}
            </div>
        `;

        // Adiciona o evento de clique para abrir o modal
        article.addEventListener('click', (e) => {
            // Impede que o modal abra se o clique for em um link (como o de preço)
            if (e.target.closest('a')) return;
            abrirModal(dado);
        });

        cardContainer.appendChild(article);
    }
}

function gerarPrecosHTML(dado) {
    if (!dado.precos || dado.precos.length === 0) {
        return ''; // Retorna string vazia se não houver preços
    }

    // Encontra o menor preço (considerando promoções)
    const menorPreco = dado.precos.reduce((min, p) => {
        const precoAtual = p.preco_promocional !== null ? p.preco_promocional : p.preco;
        return precoAtual < min ? precoAtual : min;
    }, Infinity);

    const precosOrdenados = [...dado.precos].sort((a, b) => {
        const precoA = a.preco_promocional !== null ? a.preco_promocional : a.preco;
        const precoB = b.preco_promocional !== null ? b.preco_promocional : b.preco;
        return precoA - precoB;
    });

    return `
        <div class="prices-section">
            <h3>Preços</h3>
            ${precosOrdenados.map(p => {
                const precoFinal = p.preco_promocional !== null ? p.preco_promocional : p.preco;
                const isCheapest = precoFinal === menorPreco;
                // ID único para o timer, garantindo que não haja conflitos entre o card e o modal
                const timerId = `timer-${dado.nome.replace(/\s+/g, '-')}-${p.loja}-${Math.random()}`;

                const timerHTML = p.promo_fim && p.preco_promocional
                    ? `<div class="promo-timer" id="${timerId}" data-end-time="${p.promo_fim}"></div>`
                    : '';

                return `
                <div class="price-entry ${isCheapest ? 'cheapest' : ''}">
                    <span class="price-store">${p.loja}</span>
                    <div class="price-value">
                        ${p.preco_promocional !== null ? `<span class="original-price">R$ ${p.preco.toFixed(2)}</span>` : ''}
                        <span class="promo-price">R$ ${precoFinal.toFixed(2)}</span>
                    </div>
                    <a href="${p.link_loja}" target="_blank" rel="noopener noreferrer" class="view-offer-button">Ver na Loja</a>
                    ${timerHTML}
                </div>
                `;
            }).join('')}
        </div>
    `;
}

function iniciarContadores() {
    const timers = document.querySelectorAll('[data-end-time]');
    timers.forEach(timerEl => {
        const endTime = new Date(timerEl.dataset.endTime).getTime();

        const updateTimer = () => {
            const now = new Date().getTime();
            const distance = endTime - now;

            if (distance < 0) {
                timerEl.innerHTML = "Promoção encerrada!";
                clearInterval(timerId);
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            timerEl.innerHTML = `Promoção acaba em: ${days}d ${hours}h ${minutes}m ${seconds}s`;
        };

        updateTimer(); // Chama uma vez para não esperar 1 segundo
        const timerId = setInterval(updateTimer, 1000);
        activeTimers.push(timerId); // Armazena o ID para poder limpar depois
    });
}

function abrirModal(dado) {
    const pricesHTML = gerarPrecosHTML(dado);

    // Preenche o conteúdo do modal com os dados do jogo
    modalContent.innerHTML = `
        <button id="modal-close-btn" onclick="fecharModal()">&times;</button>
        <h2 class="modal-header">${dado.nome}</h2>
        <div class="modal-body">
            <p>${dado.descricao}</p>
            ${pricesHTML}
            <div class="video-container">
                <iframe 
                    src="${dado.trailer}" 
                    title="YouTube video player" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen>
                </iframe>
            </div>
        </div>
    `;

    // Mostra o modal
    modalOverlay.classList.remove("hidden");
    iniciarContadores(); // Inicia os contadores dentro do modal
}

function fecharModal() {
    modalOverlay.classList.add("hidden");
    // Limpa o conteúdo para não mostrar o vídeo anterior rapidamente ao abrir um novo
    modalContent.innerHTML = "";
}

// Evento para fechar o modal clicando no overlay (fundo)
modalOverlay.addEventListener('click', (event) => {
    // Se o clique foi no próprio overlay (e não em seus filhos, como o modal-content)
    if (event.target === modalOverlay) {
        fecharModal();
    }
});

// Chama a função para carregar os dados quando a página é carregada
carregarDados();

// --- Event Listeners para os Filtros ---

// Filtra quando o usuário digita na barra de busca
searchInput.addEventListener('input', aplicarFiltros);

// Filtra quando uma nova categoria é selecionada
categoryFilter.addEventListener('change', aplicarFiltros);

// Filtra quando o botão "Mais Famosos" é clicado
famousFilterBtn.addEventListener('click', () => {
    famousFilterBtn.classList.toggle('active'); // Adiciona ou remove a classe 'active'
    aplicarFiltros();
});

// Filtra quando o botão de ordenação é clicado
sortBtn.addEventListener('click', () => {
    // Avança para o próximo estado de ordenação, voltando ao início se chegar ao fim
    currentSortIndex = (currentSortIndex + 1) % sortStates.length;
    // Atualiza o texto do botão
    sortBtn.textContent = `Ordem: ${sortStates[currentSortIndex]}`;
    aplicarFiltros();
});
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("./sw.js")
            .then(() => {
                console.log("PWA ativo!");
            })
            .catch(error => {
                console.error("Erro ao registrar SW:", error);
            });
    });
}