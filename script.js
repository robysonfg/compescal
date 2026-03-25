// ==========================================
// CONFIGURAÇÃO DA API
// ==========================================
const API_URL = "https://script.google.com/macros/s/AKfycbzoXv41yRgJEkYIAPRzDvRPp5aRh6PTj5TzbfaOTrKzT_yUwHn3xPtMB4F5TSlZS2wG9w/exec"; // <--- ATENÇÃO: COLE SUA URL AQUI
let usuarioLogado = null;
let dadosGeraisRH = [];
let direcaoAtual = ""; 

// ==========================================
// UTILIDADES
// ==========================================
function showToast(mensagem, tipo = 'sucesso') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    const icone = tipo === 'sucesso' ? 'ph-check-circle' : (tipo === 'erro' ? 'ph-warning-circle' : 'ph-info');
    toast.innerHTML = `<i class="ph ${icone}"></i> ${mensagem}`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3500);
}

function dataHoraInputLocal() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
}

function formatarISOparaBR(dataStr) {
    if (!dataStr) return "";
    try {
        if (String(dataStr).includes('/')) return dataStr; 
        const d = new Date(dataStr);
        if (isNaN(d.getTime())) return dataStr; 
        return d.toLocaleDateString('pt-BR') + ' ' + d.toTimeString().substring(0,5);
    } catch(e) { return dataStr; }
}

function extrairDataISO(dataBRouISO) {
    if (!dataBRouISO) return "";
    if (String(dataBRouISO).includes('T')) return String(dataBRouISO).split('T')[0];
    if (String(dataBRouISO).includes('/')) {
        const p = String(dataBRouISO).split(' ')[0].split('/');
        return `${p[2]}-${p[1]}-${p[0]}`;
    }
    return String(dataBRouISO);
}

// ==========================================
// 1. SISTEMA DE LOGIN E PERFIS
// ==========================================
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Entrando...'; btn.disabled = true;
    
    // ATUALIZAÇÃO CIRÚRGICA: Pega o login e limpa os espaços vazios nas pontas
    const login = document.getElementById('login-user').value.trim();
    const senha = document.getElementById('login-senha').value;
    
    try {
        const res = await fetch(`${API_URL}?acao=login&login=${login}&senha=${senha}`);
        const data = await res.json();
        
        if (data.status === 'sucesso') {
            if (senha === '123456') {
                abrirTrocaDeSenha(login);
            } else {
                processarLogin(data.dados);
            }
        } else { showToast(data.mensagem, 'erro'); }
    } catch(e) { showToast("Erro de conexão.", "erro"); }
    
    btn.innerHTML = 'Entrar'; btn.disabled = false;
});

function processarLogin(dados) {
    usuarioLogado = dados;
    document.getElementById('user-name').textContent = usuarioLogado.nome;
    document.getElementById('view-login').classList.add('hidden');
    
    const perfis = usuarioLogado.perfil.split(',').map(p => p.trim().toUpperCase());
    
    if (perfis.length > 1) {
        document.getElementById('btn-trocar-perfil').classList.remove('hidden');
        abrirSelecaoDePerfil(perfis);
    } else {
        document.getElementById('btn-trocar-perfil').classList.add('hidden');
        document.getElementById('view-app').classList.remove('hidden');
        direcionarTela(perfis[0]);
    }
}

function abrirTrocaDeSenha(loginUser) {
    document.getElementById('modal-nova-senha').classList.remove('hidden');
    
    document.getElementById('form-nova-senha').onsubmit = async (e) => {
        e.preventDefault();
        const nova = document.getElementById('input-nova-senha').value;
        const confirma = document.getElementById('input-confirma-senha').value;
        
        if (nova !== confirma) return showToast("As senhas não são iguais!", "erro");
        if (nova === '123456') return showToast("A nova senha não pode ser 123456.", "erro");
        
        const btn = e.target.querySelector('button');
        const txtOrg = btn.innerHTML; btn.innerHTML = 'Salvando...'; btn.disabled = true;
        
        try {
            const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ acao: 'trocar_senha', login: loginUser, novaSenha: nova }) });
            const data = await res.json();
            if(data.status === 'sucesso') {
                showToast("Senha alterada! Faça o login novamente.", "sucesso");
                document.getElementById('modal-nova-senha').classList.add('hidden');
                document.getElementById('form-login').reset();
                document.getElementById('login-senha').focus();
            } else { showToast(data.mensagem, "erro"); }
        } catch(err) { showToast("Falha ao salvar.", "erro"); }
        btn.innerHTML = txtOrg; btn.disabled = false;
    };
}

function abrirSelecaoDePerfil(perfisDisponiveis) {
    const box = document.getElementById('botoes-perfis');
    box.innerHTML = '';
    
    const icones = { 'LIDER': 'ph-users', 'PORTARIA': 'ph-door-open', 'RH': 'ph-chart-pieSlice' };
    const cores = { 'LIDER': 'btn-primary', 'PORTARIA': 'btn-danger', 'RH': 'btn-dark' };
    
    perfisDisponiveis.forEach(p => {
        if(icones[p]) {
            box.innerHTML += `<button class="btn ${cores[p]}" onclick="escolherPerfilEEntrar('${p}')" style="padding: 1rem; font-size: 1.1rem;"><i class="ph ${icones[p]}"></i> Acessar Módulo ${p}</button>`;
        }
    });
    document.getElementById('modal-selecao-perfil').classList.remove('hidden');
}

window.escolherPerfilEEntrar = function(perfilSelecionado) {
    document.getElementById('modal-selecao-perfil').classList.add('hidden');
    document.getElementById('view-app').classList.remove('hidden');
    direcionarTela(perfilSelecionado);
}

document.getElementById('btn-trocar-perfil').addEventListener('click', () => {
    abrirSelecaoDePerfil(usuarioLogado.perfil.split(',').map(p => p.trim().toUpperCase()));
});

function direcionarTela(perfil) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    if(perfil === 'LIDER') iniciarLider();
    else if(perfil === 'PORTARIA') iniciarPortaria();
    else if(perfil === 'RH') iniciarRH();
}

document.getElementById('btn-logout').addEventListener('click', () => {
    usuarioLogado = null; document.getElementById('form-login').reset();
    document.getElementById('view-app').classList.add('hidden');
    document.getElementById('view-login').classList.remove('hidden');
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
});

// ==========================================
// 2. TELA LÍDER
// ==========================================
function carregarSaudacaoLider() {
    const frases = ["Um excelente dia de trabalho!", "Sua liderança faz a diferença hoje!", "A jornada para o sucesso começa com organização.", "Vamos para mais um dia produtivo!"];
    const hora = new Date().getHours();
    const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
    document.getElementById('lider-greeting-name').innerHTML = `<strong>${saudacao}, ${usuarioLogado.nome.split(' ')[0]}!</strong>`;
    document.getElementById('lider-phrase').textContent = frases[Math.floor(Math.random() * frases.length)];
}

async function iniciarLider() {
    document.getElementById('tela-lider').classList.remove('hidden');
    carregarSaudacaoLider(); voltarSelecao(); 
    try {
        const res = await fetch(`${API_URL}?tabela=Motivos`);
        const json = await res.json();
        const select = document.getElementById('motivo-saida');
        select.innerHTML = '<option value="">Selecione...</option>';
        if(json.dados) json.dados.forEach(m => select.innerHTML += `<option value="${m.Motivo}">${m.Motivo}</option>`);
    } catch(e) { }
}

window.iniciarFormulario = function(tipo) {
    direcaoAtual = tipo;
    document.getElementById('selecao-direcao').classList.add('hidden');
    document.getElementById('form-autorizacao').classList.remove('hidden');
    document.getElementById('titulo-form').innerHTML = tipo === 'Saída' ? `<i class="ph ph-sign-out"></i> Autorizando Saída` : `<i class="ph ph-sign-in"></i> Autorizando Entrada`;
    document.getElementById('label-prev-acao').textContent = tipo === 'Saída' ? 'Prev. Saída' : 'Prev. Chegada';
    document.getElementById('prev-acao').value = dataHoraInputLocal();
    const boxRetorno = document.getElementById('box-vai-retornar');
    if(tipo === 'Entrada') { boxRetorno.classList.add('hidden'); document.getElementById('vai-retornar').value = 'Não'; } 
    else { boxRetorno.classList.remove('hidden'); }
    togglePrevisaoRetorno();
}

window.voltarSelecao = function() {
    document.getElementById('form-autorizacao').reset();
    document.getElementById('form-autorizacao').classList.add('hidden');
    document.getElementById('selecao-direcao').classList.remove('hidden');
}

window.togglePrevisaoRetorno = function() {
    const select = document.getElementById('vai-retornar').value;
    const box = document.getElementById('box-prev-retorno'); const input = document.getElementById('prev-retorno');
    if(select === 'Sim' && direcaoAtual === 'Saída') { box.classList.remove('hidden'); input.required = true; input.value = dataHoraInputLocal(); } 
    else { box.classList.add('hidden'); input.required = false; input.value = ''; }
}

document.getElementById('btn-buscar-mat').addEventListener('click', buscarMatricula);
document.getElementById('mat-colaborador').addEventListener('blur', buscarMatricula);

async function buscarMatricula() {
    const mat = document.getElementById('mat-colaborador').value;
    if(!mat) return;
    const aviso = document.getElementById('aviso-mat'); const inputNome = document.getElementById('nome-colaborador');
    aviso.textContent = "Buscando..."; aviso.classList.remove('hidden'); aviso.classList.replace('text-danger', 'text-light');
    try {
        const res = await fetch(`${API_URL}?acao=buscar_colaborador&matricula=${mat}`);
        const data = await res.json();
        if(data.status === 'sucesso') { inputNome.value = data.dados.nome; aviso.classList.add('hidden'); } 
        else { inputNome.value = ''; aviso.textContent = "Não encontrada."; aviso.classList.replace('text-light', 'text-danger'); }
    } catch(e) { aviso.textContent = "Erro."; aviso.classList.replace('text-light', 'text-danger'); }
}

document.getElementById('form-autorizacao').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('nome-colaborador').value;
    if(!nome) return showToast("Busque a matrícula primeiro.", "erro");
    
    const btn = e.target.querySelector('button[type="submit"]');
    const txtOrg = btn.innerHTML; btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Autorizando...'; btn.disabled = true;
    
    const dados = [
        formatarISOparaBR(dataHoraInputLocal()), 
        document.getElementById('mat-colaborador').value, nome, document.getElementById('motivo-saida').value,
        usuarioLogado.nome, document.getElementById('obs-saida').value,
        formatarISOparaBR(document.getElementById('prev-acao').value),
        document.getElementById('vai-retornar').value,
        formatarISOparaBR(document.getElementById('prev-retorno').value), direcaoAtual
    ];

    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ acao: 'nova_autorizacao', dados: dados }) });
        const data = await res.json();
        if(data.status === 'sucesso') { showToast("Autorização enviada!", "sucesso"); voltarSelecao(); } 
        else { showToast(data.mensagem, "erro"); }
    } catch(err) { showToast("Falha na conexão.", "erro"); }
    btn.innerHTML = txtOrg; btn.disabled = false;
});

// ==========================================
// 3. TELA PORTARIA E MODAL OTIMISTA
// ==========================================
let btnConfirmarOrigem;
let idAtendimentoOrigem;

function showConfirmModal(titulo, mensagem, acaoPortaria, idApp) {
    idAtendimentoOrigem = idApp;
    document.getElementById('modal-title').innerHTML = `<i class="ph ph-warning-circle"></i> ${titulo}`;
    document.getElementById('modal-message').textContent = mensagem;
    
    const timeBox = document.getElementById('modal-time-box');
    btnConfirmarOrigem = document.getElementById('btn-modal-confirm');
    
    if(acaoPortaria.includes('faltou') || acaoPortaria === 'nao_retornou') {
        timeBox.classList.add('hidden');
        btnConfirmarOrigem.textContent = "Confirmar Falta";
        btnConfirmarOrigem.className = "btn btn-dark";
    } else {
        timeBox.classList.remove('hidden');
        const label = document.getElementById('modal-time-label');
        label.textContent = acaoPortaria === 'saida' ? 'Horário Real da Saída:' : (acaoPortaria === 'entrada' ? 'Horário Real da Entrada:' : 'Horário Real do Retorno:');
        document.getElementById('modal-time-input').value = dataHoraInputLocal();
        btnConfirmarOrigem.textContent = "Confirmar";
        btnConfirmarOrigem.className = "btn btn-success";
    }
    
    document.getElementById('modal-confirmacao').classList.remove('hidden');
    return new Promise(resolve => resolveModal = resolve);
}

document.getElementById('btn-modal-cancel').addEventListener('click', () => {
    document.getElementById('modal-confirmacao').classList.add('hidden');
    resolveModal({ confirmado: false });
});

document.getElementById('btn-modal-confirm').addEventListener('click', () => {
    btnConfirmarOrigem.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Processando...';
    btnConfirmarOrigem.disabled = true;
    
    const horario = document.getElementById('modal-time-input').value;
    document.getElementById('modal-confirmacao').classList.add('hidden');
    
    const cartao = document.getElementById(`card-${idAtendimentoOrigem}`);
    if(cartao) cartao.style.display = 'none';

    resolveModal({ confirmado: true, horaISO: horario });
    setTimeout(() => { btnConfirmarOrigem.disabled = false; }, 1000);
});

async function iniciarPortaria() {
    document.getElementById('tela-portaria').classList.remove('hidden');
    carregarPortaria();
}

async function carregarPortaria() {
    const listaSaida = document.getElementById('lista-portaria-saida');
    const listaEntrada = document.getElementById('lista-portaria-entrada');
    const listaRetorno = document.getElementById('lista-portaria-retorno');
    const listaHistorico = document.getElementById('lista-historico-portaria');
    
    listaSaida.innerHTML = '<div style="text-align:center;"><i class="ph ph-spinner ph-spin" style="font-size:2rem;"></i></div>';
    listaEntrada.innerHTML = ''; listaRetorno.innerHTML = ''; listaHistorico.innerHTML = '';
    
    try {
        const res = await fetch(`${API_URL}?tabela=Lancamentos`); 
        const json = await res.json();
        const autorizacoes = json.dados || [];
        
        const dataHoje = new Date().toLocaleDateString('pt-BR');
        let htmlSaida = '', htmlEntrada = '', htmlRetorno = '', htmlHistorico = '';

        autorizacoes.reverse().forEach(auth => {
            const ehEntrada = auth.Direcao === 'Entrada';
            const vaiRetornarTag = (!ehEntrada && auth.Vai_Retornar === 'Sim') ? `<span class="tag-sim">Requer Retorno</span>` : ((!ehEntrada) ? `<span class="tag-nao">Sem Retorno</span>` : '');
            
            const pAcaoBR = formatarISOparaBR(auth.Previsao_Saida);
            const pRetornoBR = formatarISOparaBR(auth.Previsao_Retorno);
            const acaoRealBR = formatarISOparaBR(auth.Data_Hora_Saida); 
            const retRealBR = formatarISOparaBR(auth.Data_Hora_Retorno); 

            const detalhesComuns = `
                <div class="details">
                    <div><strong>Matrícula:</strong> ${auth.Matricula}</div>
                    <div><strong>Motivo:</strong> ${auth.Motivo}</div>
                    <div><strong>Líder:</strong> ${auth.Lider}</div>
                    ${auth.Observacao ? `<div><strong>Obs:</strong> ${auth.Observacao}</div>` : ''}
                </div>
            `;

            if (auth.Status === "Aguardando Liberação de Saída" || auth.Status === "Aguardando Portaria") {
                htmlSaida += `<div class="auth-card" id="card-${auth.ID}" style="border-left-color: var(--accent);"><div style="display:flex; justify-content:space-between;"><div class="name">${auth.Nome}</div> ${vaiRetornarTag}</div>${detalhesComuns}<div class="details"><strong>Prev. Saída:</strong> <span class="text-danger">${pAcaoBR}</span></div><button onclick="acionarPortaria('${auth.ID}', '${auth.Nome}', 'saida')" class="btn btn-danger mt-1"><i class="ph ph-sign-out"></i> Confirmar Saída</button></div>`;
            } 
            else if (auth.Status === "Aguardando Liberação de Entrada") {
                htmlEntrada += `<div class="auth-card" id="card-${auth.ID}" style="border-left-color: var(--primary);"><div class="name">${auth.Nome}</div>${detalhesComuns}<div class="details"><strong>Prev. Chegada:</strong> <span class="text-primary">${pAcaoBR}</span></div><div style="display:flex; gap:10px; margin-top:10px;"><button onclick="acionarPortaria('${auth.ID}', '${auth.Nome}', 'entrada')" class="btn btn-primary" style="flex:2;"><i class="ph ph-sign-in"></i> Confirmar Entrada</button><button onclick="acionarPortaria('${auth.ID}', '${auth.Nome}', 'faltou_entrada')" class="btn btn-dark" style="flex:1;"><i class="ph ph-x-circle"></i> Faltou</button></div></div>`;
            }
            else if (auth.Status === "Aguardando Retorno") {
                htmlRetorno += `<div class="auth-card" id="card-${auth.ID}" style="border-left-color: var(--warning);"><div class="name">${auth.Nome}</div>${detalhesComuns}<div class="details"><strong>Saiu às:</strong> ${acaoRealBR}</div><div class="details"><strong>Prev. Retorno:</strong> <span style="color:var(--warning); font-weight:bold;">${pRetornoBR}</span></div><div style="display:flex; gap:10px; margin-top:10px;"><button onclick="acionarPortaria('${auth.ID}', '${auth.Nome}', 'retorno')" class="btn" style="flex:2; background-color: var(--warning); color: white;"><i class="ph ph-clock-counter-clockwise"></i> Confirmar Retorno</button><button onclick="acionarPortaria('${auth.ID}', '${auth.Nome}', 'faltou_saida')" class="btn btn-dark" style="flex:1;"><i class="ph ph-x-circle"></i> Faltou</button></div></div>`;
            }
            else if ((auth.Status === "Concluído" || auth.Status === "Saída Confirmada" || auth.Status.includes("Faltou") || auth.Status === "Não Retornou") && (acaoRealBR.includes(dataHoje) || retRealBR.includes(dataHoje) || pAcaoBR.includes(dataHoje))) {
                let classeCor = ""; let icone = "";
                if(auth.Status.includes("Faltou") || auth.Status === "Não Retornou") { classeCor = "hist-falta"; icone = auth.Status; }
                else if (auth.Vai_Retornar === 'Sim' && retRealBR) { classeCor = "hist-retorno"; icone = "Retorno Concluído"; }
                else if (ehEntrada) { classeCor = "hist-entrada"; icone = "Entrada Concluída"; }
                else { classeCor = "hist-saida"; icone = "Saída Concluída"; }

                htmlHistorico += `<div class="auth-card ${classeCor}"><div style="display:flex; justify-content:space-between;"><div class="name">${auth.Nome}</div><span style="font-size:0.7rem; font-weight:bold; color:var(--text-light);">${icone}</span></div><div class="details" style="font-size:0.8rem;"><div>Líder: ${auth.Lider} | Motivo: ${auth.Motivo}</div><div><strong>${ehEntrada ? 'Entrou' : 'Saiu'}:</strong> ${acaoRealBR || '-'}</div>${auth.Vai_Retornar === 'Sim' ? `<div><strong>Retornou:</strong> <span style="${auth.Status.includes('Faltou') || auth.Status === 'Não Retornou' ? 'color:var(--accent); font-weight:bold;' : ''}">${retRealBR || '-'}</span></div>` : ''}</div></div>`;
            }
        });

        listaSaida.innerHTML = htmlSaida || '<p class="text-light">Ninguém aguardando saída.</p>';
        listaEntrada.innerHTML = htmlEntrada || '<p class="text-light">Ninguém aguardando entrada.</p>';
        listaRetorno.innerHTML = htmlRetorno || '<p class="text-light">Ninguém aguardando retorno.</p>';
        listaHistorico.innerHTML = htmlHistorico || '<p class="text-light">Histórico vazio hoje.</p>';
        
    } catch(e) { listaSaida.innerHTML = '<p class="text-danger">Erro.</p>'; }
}

window.acionarPortaria = async function(id, nome, acao) {
    const titulo = acao.includes('faltou') ? 'Faltou' : 'Liberar Acesso';
    let msg = `Registrar o acesso de ${nome}?`;
    if(acao === 'faltou_entrada') msg = `Confirmar que ${nome} NÃO compareceu para a Entrada?`;
    if(acao === 'faltou_saida') msg = `Confirmar que ${nome} NÃO retornou da Saída?`;
    
    const result = await showConfirmModal(titulo, msg, acao, id);
    if(!result.confirmado) return;
    
    const horaAjustadaBR = acao.includes('faltou') ? 'Faltou' : formatarISOparaBR(result.horaISO); 
    
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ acao: 'acao_portaria', id: id, tipoAcao: acao, hora: horaAjustadaBR })
        });
        const data = await res.json();
        
        if(data.status === 'sucesso') { 
            showToast("Sincronizado na Nuvem!", "sucesso"); 
            carregarPortaria();
        } else { 
            showToast(data.mensagem, "erro"); 
            const cartao = document.getElementById(`card-${id}`);
            if(cartao) cartao.style.display = 'flex';
        }
    } catch(e) { 
        showToast("Erro na internet. Cartão restaurado.", "erro"); 
        const cartao = document.getElementById(`card-${id}`);
        if(cartao) cartao.style.display = 'flex';
    }
}

// ==========================================
// 4. TELA RH (Dashboards e Filtros Avançados)
// ==========================================
async function iniciarRH() {
    document.getElementById('tela-rh').classList.remove('hidden');
    document.getElementById('tbody-relatorio').innerHTML = '<tr><td colspan="8" class="text-center">Atualizando painel...</td></tr>';
    try {
        const res = await fetch(`${API_URL}?tabela=Lancamentos`);
        const json = await res.json();
        dadosGeraisRH = json.dados || [];
        gerarKPIsERanking(dadosGeraisRH);
        preencherOpcoesFiltros(dadosGeraisRH);
        document.getElementById('tipo-relatorio').value = 'geral';
        toggleFiltrosRH();
        aplicarFiltrosRH();
    } catch(e) { showToast("Erro no RH.", "erro"); }
}

function gerarKPIsERanking(dados) {
    const hojeISO = new Date().toISOString().split('T')[0]; 
    const mesAtualISO = hojeISO.substring(0,7); 
    let contHoje = 0, contMes = 0; let rankingMap = {};
    dados.forEach(d => {
        const dataPedidoISO = extrairDataISO(d.Data_Hora_Pedido);
        if(dataPedidoISO === hojeISO) contHoje++;
        if(dataPedidoISO.startsWith(mesAtualISO)) {
            contMes++;
            const chaveColab = `${d.Matricula} - ${d.Nome}`;
            rankingMap[chaveColab] = (rankingMap[chaveColab] || 0) + 1;
        }
    });
    document.getElementById('kpi-hoje').textContent = contHoje;
    document.getElementById('kpi-mes').textContent = contMes;
    
    const arrayRanking = Object.keys(rankingMap).map(key => { return { nome: key, total: rankingMap[key] }; });
    arrayRanking.sort((a, b) => b.total - a.total);
    const ulRanking = document.getElementById('lista-ranking'); ulRanking.innerHTML = '';
    const top5 = arrayRanking.slice(0, 5);
    
    if(top5.length === 0) { ulRanking.innerHTML = '<li><span class="text-light">Nenhuma autorização neste mês.</span></li>'; } 
    else { top5.forEach((item, index) => { ulRanking.innerHTML += `<li><span><strong>${index + 1}º</strong> ${item.nome}</span><span class="badge-rank">${item.total} req.</span></li>`; }); }
}

function preencherOpcoesFiltros(dados) {
    const lideres = [...new Set(dados.map(d => d.Lider).filter(l => l))];
    const motivos = [...new Set(dados.map(d => d.Motivo).filter(m => m))];
    const selLider = document.getElementById('filtro-lider-select'); selLider.innerHTML = '<option value="">Todos</option>';
    lideres.sort().forEach(l => selLider.innerHTML += `<option value="${l}">${l}</option>`);
    const selMotivo = document.getElementById('filtro-motivo-select'); selMotivo.innerHTML = '<option value="">Todos</option>';
    motivos.sort().forEach(m => selMotivo.innerHTML += `<option value="${m}">${m}</option>`);
}

window.toggleFiltrosRH = function() {
    const tipo = document.getElementById('tipo-relatorio').value;
    document.getElementById('box-filtro-lider').classList.add('hidden'); document.getElementById('box-filtro-colab').classList.add('hidden'); document.getElementById('box-filtro-motivo').classList.add('hidden');
    if(tipo === 'lider') document.getElementById('box-filtro-lider').classList.remove('hidden');
    if(tipo === 'colaborador') document.getElementById('box-filtro-colab').classList.remove('hidden');
    if(tipo === 'motivo') document.getElementById('box-filtro-motivo').classList.remove('hidden');
}

window.aplicarFiltrosRH = function() {
    const tipo = document.getElementById('tipo-relatorio').value;
    const dtIn = document.getElementById('filtro-data-inicio').value; const dtFim = document.getElementById('filtro-data-fim').value; 
    const btn = document.querySelector('.filter-group').nextElementSibling;
    const txtOrg = btn.innerHTML; btn.innerHTML = 'Filtrando...'; btn.disabled = true;

    let dadosFiltrados = dadosGeraisRH.filter(d => {
        let ok = true;
        if (dtIn || dtFim) {
            const dFmt = extrairDataISO(d.Data_Hora_Pedido);
            if (dtIn && dFmt < dtIn) ok = false;
            if (dtFim && dFmt > dtFim) ok = false;
        }
        return ok;
    });

    if (tipo === 'lider') {
        const val = document.getElementById('filtro-lider-select').value;
        if(val) dadosFiltrados = dadosFiltrados.filter(d => d.Lider === val);
        renderizarTabelaGeralRH(dadosFiltrados);
    } 
    else if (tipo === 'colaborador') {
        const val = document.getElementById('filtro-colab-input').value.toLowerCase();
        if(val) dadosFiltrados = dadosFiltrados.filter(d => String(d.Matricula).toLowerCase().includes(val) || String(d.Nome).toLowerCase().includes(val));
        renderizarTabelaGeralRH(dadosFiltrados);
    }
    else if (tipo === 'motivo') {
        const val = document.getElementById('filtro-motivo-select').value;
        if(val) dadosFiltrados = dadosFiltrados.filter(d => d.Motivo === val);
        renderizarTabelaGeralRH(dadosFiltrados);
    }
    else if (tipo === 'faltou_entrada') {
        dadosFiltrados = dadosFiltrados.filter(d => d.Status === 'Faltou - Entrada'); renderizarTabelaGeralRH(dadosFiltrados);
    }
    else if (tipo === 'faltou_saida') {
        dadosFiltrados = dadosFiltrados.filter(d => d.Status === 'Faltou - Saída' || d.Status === 'Não Retornou'); renderizarTabelaGeralRH(dadosFiltrados);
    }
    else if (tipo === 'ranking') { renderizarTabelaRankingRH(dadosFiltrados); } 
    else { renderizarTabelaGeralRH(dadosFiltrados); }
    
    btn.innerHTML = txtOrg; btn.disabled = false;
    showToast(`${dadosFiltrados.length} registros encontrados.`, 'info');
}

function renderizarTabelaGeralRH(dados) {
    const thead = document.getElementById('thead-relatorio'); const tbody = document.getElementById('tbody-relatorio');
    thead.innerHTML = `<tr><th>Data/Pedido</th><th>Tipo</th><th>Matrícula</th><th>Colaborador</th><th>Motivo</th><th>Líder</th><th>Status</th><th>Liberação</th><th>Retorno</th></tr>`;
    tbody.innerHTML = '';
    if(dados.length === 0) return tbody.innerHTML = '<tr><td colspan="9" class="text-center">Nenhum dado encontrado.</td></tr>';
    dados.reverse().forEach(d => {
        let bClass = 'pend';
        if(d.Status === 'Concluído' || d.Status === 'Saída Confirmada') bClass = 'ok';
        if(d.Status === 'Aguardando Retorno') bClass = 'ret';
        if(d.Status.includes('Faltou') || d.Status === 'Não Retornou') bClass = 'falta';

        const tipoDir = d.Direcao === 'Entrada' ? 'Entrada' : 'Saída';
        tbody.innerHTML += `<tr><td>${formatarISOparaBR(d.Data_Hora_Pedido)}</td><td><strong>${tipoDir}</strong></td><td>${d.Matricula}</td><td>${d.Nome}</td><td>${d.Motivo}</td><td>${d.Lider}</td><td><span class="status-badge ${bClass}">${d.Status}</span></td><td>${formatarISOparaBR(d.Data_Hora_Saida)}</td><td style="${d.Status.includes('Faltou') || d.Status === 'Não Retornou' ? 'color:red; font-weight:bold;' : ''}">${formatarISOparaBR(d.Data_Hora_Retorno)}</td></tr>`;
    });
}

function renderizarTabelaRankingRH(dados) {
    const thead = document.getElementById('thead-relatorio'); const tbody = document.getElementById('tbody-relatorio');
    thead.innerHTML = `<tr><th>Posição</th><th>Matrícula</th><th>Colaborador</th><th>Total de Autorizações</th></tr>`;
    tbody.innerHTML = '';
    if(dados.length === 0) return tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum dado encontrado.</td></tr>';

    let mapa = {}; dados.forEach(d => { const k = `${d.Matricula}__${d.Nome}`; mapa[k] = (mapa[k] || 0) + 1; });
    const rankArray = Object.keys(mapa).map(k => ({ matricula: k.split('__')[0], nome: k.split('__')[1], total: mapa[k] }));
    rankArray.sort((a,b) => b.total - a.total);
    rankArray.forEach((r, i) => { tbody.innerHTML += `<tr><td><strong>${i+1}º</strong></td><td>${r.matricula}</td><td>${r.nome}</td><td><span style="color:var(--accent); font-weight:bold;">${r.total}</span></td></tr>`; });
}

window.exportarExcel = function() {
    const tabela = document.getElementById('tabela-relatorio'); const workbook = XLSX.utils.table_to_book(tabela, {sheet: "Relatório"});
    XLSX.writeFile(workbook, "Relatorio_Compescal.xlsx");
}
window.exportarPDF = function() {
    const { jsPDF } = window.jspdf; const doc = new jsPDF('landscape');
    const titulo = document.getElementById('tipo-relatorio').options[document.getElementById('tipo-relatorio').selectedIndex].text;
    doc.setFontSize(16); doc.text(`Relatório Compescal: ${titulo}`, 14, 20);
    doc.autoTable({ html: '#tabela-relatorio', startY: 30, theme: 'striped', headStyles: { fillColor: [15, 44, 89] }, styles: { fontSize: 8 } });
    doc.save("Relatorio_Compescal.pdf");
}
