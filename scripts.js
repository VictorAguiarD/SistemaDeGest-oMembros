// app-improved.js - Versão refatorada com melhorias de UX e filtro por data de nascimento
(function () {
  // ========= Utilitários =========
  const Utils = {
    todayStr: () => new Date().toISOString().slice(0, 10),
    $: (sel) => document.querySelector(sel),
    $$: (sel) => document.querySelectorAll(sel),
    formatDate: (dateStr) => {
      if (!dateStr) return '—';
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR');
    },
    calculateAge: (birthDate) => {
      if (!birthDate) return null;
      const today = new Date();
      const birth = new Date(birthDate);
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    },
    generateId: () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  };

  // ========= Sistema de Notificações (Toast) =========
  const Toast = {
    container: null,

    init() {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.className = 'fixed top-4 right-4 z-50 space-y-2';
      document.body.appendChild(this.container);
    },

    show(message, type = 'success', duration = 3000) {
      const toast = document.createElement('div');
      const bgColor = type === 'success' ? 'bg-green-500'
        : type === 'error' ? 'bg-red-500'
        : type === 'warning' ? 'bg-yellow-500'
        : 'bg-blue-500';

      toast.className = `${bgColor} text-white px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full opacity-0`;
      toast.innerHTML = `
        <div class="flex items-center gap-2">
          <span>${message}</span>
          <button class="ml-2 text-white hover:text-gray-200" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
      `;

      this.container.appendChild(toast);

      // Animar entrada
      setTimeout(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
      }, 10);

      // Auto-remover
      setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }
  };

  // ========= Modal de Confirmação Personalizado =========
  const ConfirmModal = {
    modal: null,

    init() {
      this.modal = document.createElement('div');
      this.modal.id = 'confirm-modal';
      this.modal.className = 'hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
      this.modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
          <h3 id="confirm-title" class="text-lg font-semibold mb-2">Confirmar ação</h3>
          <p id="confirm-message" class="text-gray-600 mb-6">Tem certeza que deseja continuar?</p>
          <div class="flex justify-end gap-3">
            <button id="confirm-cancel" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancelar</button>
            <button id="confirm-ok" class="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600">Confirmar</button>
          </div>
        </div>
      `;
      document.body.appendChild(this.modal);
    },

    show(title, message, onConfirm) {
      Utils.$('#confirm-title').textContent = title;
      Utils.$('#confirm-message').textContent = message;
      this.modal.classList.remove('hidden');

      const handleCancel = () => {
        this.modal.classList.add('hidden');
        Utils.$('#confirm-cancel').removeEventListener('click', handleCancel);
        Utils.$('#confirm-ok').removeEventListener('click', handleOk);
      };

      const handleOk = () => {
        this.modal.classList.add('hidden');
        onConfirm();
        Utils.$('#confirm-cancel').removeEventListener('click', handleCancel);
        Utils.$('#confirm-ok').removeEventListener('click', handleOk);
      };

      Utils.$('#confirm-cancel').addEventListener('click', handleCancel);
      Utils.$('#confirm-ok').addEventListener('click', handleOk);
    }
  };

  // ========= Gerenciador de Estado =========
  const State = {
    members: [],
    filter: 'all',
    ageFilter: 'all',
    selectedDate: Utils.todayStr(),
    searchTerm: '',
    sortBy: 'name',
    sortOrder: 'asc',

    STORAGE_KEY: 'members_attendance_v2',

    loadFromStorage() {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        try {
          this.members = JSON.parse(raw);
          // Migrar dados antigos se necessário
          this.members = this.members.map(member => ({
            ...member,
            birthDate: member.birthDate || '',
            email: member.email || ''
          }));
        } catch {
          this.members = [];
        }
      }
    },

    saveToStorage() {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.members));
    },

    addMember(member) {
      this.members.push({
        id: Utils.generateId(),
        ...member
      });
      this.saveToStorage();
      Toast.show('Membro adicionado com sucesso!');
    },

    updateMember(id, updates) {
      this.members = this.members.map(m =>
        m.id === id ? { ...m, ...updates } : m
      );
      this.saveToStorage();
      Toast.show('Membro atualizado com sucesso!');
    },

    removeMember(id) {
      this.members = this.members.filter(m => m.id !== id);
      this.saveToStorage();
      Toast.show('Membro removido com sucesso!');
    },

    clearAll() {
      this.members = [];
      this.saveToStorage();
      Toast.show('Todos os membros foram removidos!', 'warning');
    },

    getFilteredMembers() {
      let filtered = this.members;

      // Filtro por status
      if (this.filter !== 'all') {
        filtered = filtered.filter(m => m.status === this.filter);
      }

      // Filtro por idade
      if (this.ageFilter !== 'all') {
        filtered = filtered.filter(m => {
          const age = Utils.calculateAge(m.birthDate);
          if (age === null) return false;
          
          switch (this.ageFilter) {
            case '0-17': return age >= 0 && age <= 17;
            case '18-30': return age >= 18 && age <= 30;
            case '31-50': return age >= 31 && age <= 50;
            case '51-70': return age >= 51 && age <= 70;
            case '70+': return age > 70;
            default: return true;
          }
        });
      }

      // Busca
      if (this.searchTerm) {
        const term = this.searchTerm.toLowerCase();
        filtered = filtered.filter(m =>
          m.name.toLowerCase().includes(term) ||
          (m.birthDate && m.birthDate.includes(term)) ||
          (m.email && m.email.toLowerCase().includes(term))
        );
      }

      // Ordenação
      filtered.sort((a, b) => {
        let aVal = a[this.sortBy] || '';
        let bVal = b[this.sortBy] || '';

        if (this.sortBy === 'lastSeen' || this.sortBy === 'birthDate') {
          aVal = new Date(aVal || '1900-01-01');
          bVal = new Date(bVal || '1900-01-01');
        } else if (this.sortBy === 'age') {
          aVal = Utils.calculateAge(a.birthDate) || 0;
          bVal = Utils.calculateAge(b.birthDate) || 0;
        } else {
          aVal = aVal.toString().toLowerCase();
          bVal = bVal.toString().toLowerCase();
        }

        if (aVal < bVal) return this.sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return this.sortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      return filtered;
    },

    getStats() {
      const stats = this.members.reduce(
        (acc, m) => {
          acc.total += 1;
          if (m.status === 'present') acc.present += 1;
          else if (m.status === 'absent') acc.absent += 1;
          else if (m.status === 'long-missing') acc.longMissing += 1;
          return acc;
        },
        { total: 0, present: 0, absent: 0, longMissing: 0 }
      );

      // Adicionar estatísticas de idade
      const ages = this.members
        .map(m => Utils.calculateAge(m.birthDate))
        .filter(age => age !== null);
      
      stats.averageAge = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
      
      return stats;
    }
  };

  // ========= Renderização =========
  const Renderer = {
    renderStats() {
      const stats = State.getStats();
      const statsGrid = Utils.$('#statsGrid');
      statsGrid.innerHTML = '';

      statsGrid.appendChild(this.createCard('Total', stats.total));
      statsGrid.appendChild(this.createCard('Presentes', stats.present, 'green'));
      statsGrid.appendChild(this.createCard('Faltas', stats.absent, 'yellow'));
      statsGrid.appendChild(this.createCard('Há muito tempo sem vir', stats.longMissing, 'red'));
    },

    createCard(label, value, accent) {
      const div = document.createElement('div');
      div.className =
        accent === 'green' ? 'card card--green' :
        accent === 'yellow' ? 'card card--yellow' :
        accent === 'red' ? 'card card--red' : 'card';
      div.innerHTML = `
        <div>
          <div class="card__label">${label}</div>
          <div class="card__value">${value}</div>
        </div>
      `;
      return div;
    },

    statusBadge(status) {
      if (status === 'present') return `<span class="badge badge--present">Presente</span>`;
      if (status === 'absent') return `<span class="badge badge--absent">Falta</span>`;
      return `<span class="badge badge--long">Há muito tempo sem vir</span>`;
    },

    renderTable() {
      const tbody = Utils.$('#membersTbody');
      const members = State.getFilteredMembers();

      if (!tbody) return;

      if (members.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-gray-500">Nenhum membro encontrado</td></tr>`;
        return;
      }

      tbody.innerHTML = members.map(m => {
        const age = Utils.calculateAge(m.birthDate);
        const ageDisplay = age !== null ? `${age} anos` : '—';
        
        return `
        <tr class="border-t hover:bg-gray-50">
          <td class="px-3 py-3">${m.name}</td>
          <td class="px-3 py-3">${Utils.formatDate(m.birthDate)}</td>
          <td class="px-3 py-3">${ageDisplay}</td>
          <td class="px-3 py-3">${Utils.formatDate(m.lastSeen)}</td>
          <td class="px-3 py-3">${this.statusBadge(m.status)}</td>
          <td class="px-3 py-3 text-right">
            <div class="flex gap-1 justify-end">
              <button data-act="present" data-id="${m.id}" class="px-2 py-1 bg-green-50 text-green-700 rounded text-xs hover:bg-green-100" title="Marcar como presente">✓</button>
              <button data-act="absent" data-id="${m.id}" class="px-2 py-1 bg-yellow-50 text-yellow-700 rounded text-xs hover:bg-yellow-100" title="Marcar como falta">−</button>
              <button data-act="long" data-id="${m.id}" class="px-2 py-1 bg-red-50 text-red-700 rounded text-xs hover:bg-red-100" title="Há muito tempo sem vir">⚠</button>
              <button data-act="edit" data-id="${m.id}" class="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs hover:bg-blue-100" title="Editar">✎</button>
              <button data-act="remove" data-id="${m.id}" class="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300" title="Remover">×</button>
            </div>
          </td>
        </tr>
      `;
      }).join('');

      // Ações linha a linha
      Utils.$$('button[data-act]').forEach(btn => {
        const id = btn.dataset.id;
        const act = btn.dataset.act;

        btn.onclick = () => {
          if (act === 'present') {
            State.updateMember(id, { status: 'present', lastSeen: State.selectedDate });
            this.renderAll();
          } else if (act === 'absent') {
            State.updateMember(id, { status: 'absent' });
            this.renderAll();
          } else if (act === 'long') {
            State.updateMember(id, { status: 'long-missing' });
            this.renderAll();
          } else if (act === 'remove') {
            const member = State.members.find(m => m.id === id);
            ConfirmModal.show(
              'Remover Membro',
              `Tem certeza que deseja remover "${member?.name || 'este membro'}"?`,
              () => {
                State.removeMember(id);
                this.renderAll();
              }
            );
          } else if (act === 'edit') {
            const member = State.members.find(m => m.id === id);
            MemberModal.open(member);
          }
        };
      });
    },

    renderTableHeaders() {
      const headers = Utils.$$('th[data-sort]');
      headers.forEach(th => {
        const sortBy = th.dataset.sort;
        th.classList.add('cursor-pointer', 'hover:bg-gray-100');

        // Indicador de ordenação
        const label = th.textContent.replace(/ [↑↓]$/, '');
        if (State.sortBy === sortBy) {
          th.textContent = label + (State.sortOrder === 'asc' ? ' ↑' : ' ↓');
        } else {
          th.textContent = label;
        }

        th.onclick = () => {
          if (State.sortBy === sortBy) {
            State.sortOrder = State.sortOrder === 'asc' ? 'desc' : 'asc';
          } else {
            State.sortBy = sortBy;
            State.sortOrder = 'asc';
          }
          this.renderAll();
        };
      });
    },

    renderAll() {
      this.renderStats();
      this.renderTable();
      this.renderTableHeaders();
    }
  };

  // ========= Modal de Membro =========
  const MemberModal = {
    modal: null,
    form: null,
    editingId: null,

    init() {
      this.modal = Utils.$('#memberModal');
      this.form = Utils.$('#memberForm');

      const btnCancel = Utils.$('#btnCancel');
      if (btnCancel) btnCancel.addEventListener('click', () => this.close());

      if (this.form) {
        this.form.addEventListener('submit', (e) => {
          e.preventDefault();

          const name = Utils.$('#memberName')?.value.trim();
          const email = Utils.$('#memberEmail')?.value.trim();
          const birthDate = Utils.$('#memberBirthDate')?.value;
          const lastSeen = Utils.$('#memberLastSeen')?.value;
          const status = Utils.$('#memberStatus')?.value;

          if (!name) {
            Toast.show('Por favor, preencha o nome do membro.', 'error');
            return;
          }

          const memberData = { name, email, birthDate, lastSeen, status };

          if (this.editingId) {
            State.updateMember(this.editingId, memberData);
          } else {
            State.addMember(memberData);
          }

          Renderer.renderAll();
          this.close();
        });
      }
    },

    open(member = null) {
      if (!this.modal) return;
      this.modal.classList.remove('hidden');

      if (member) {
        Utils.$('#modalTitle').textContent = 'Editar Membro';
        if (Utils.$('#memberName')) Utils.$('#memberName').value = member.name;
        if (Utils.$('#memberEmail')) Utils.$('#memberEmail').value = member.email || '';
        if (Utils.$('#memberBirthDate')) Utils.$('#memberBirthDate').value = member.birthDate || '';
        if (Utils.$('#memberLastSeen')) Utils.$('#memberLastSeen').value = member.lastSeen || '';
        if (Utils.$('#memberStatus')) Utils.$('#memberStatus').value = member.status;
        this.editingId = member.id;
      } else {
        Utils.$('#modalTitle').textContent = 'Novo Membro';
        this.form?.reset();
        this.editingId = null;
      }
    },

    close() {
      if (this.modal) this.modal.classList.add('hidden');
    }
  };

  // ========= Importação/Exportação =========
  const ImportExport = {
    init() {
      const fileInput = Utils.$('#fileInput');
      if (fileInput) fileInput.addEventListener('change', this.handleFile.bind(this));

      const btnExport = Utils.$('#btnExport');
      if (btnExport) btnExport.addEventListener('click', this.exportCSV.bind(this));
    },

    async handleFile(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const name = file.name.toLowerCase();

      try {
        if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data);
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          this.ingestRows(json);
        } else if (name.endsWith('.csv')) {
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => this.ingestRows(results.data),
          });
        } else {
          Toast.show('Formato não suportado. Envie .xlsx ou .csv', 'error');
        }
      } catch (error) {
        Toast.show('Erro ao processar arquivo: ' + error.message, 'error');
      }

      e.target.value = '';
    },

    ingestRows(rows) {
      const newMembers = rows.map((r, idx) => {
        const lower = Object.keys(r).reduce((acc, k) => {
          acc[String(k).toLowerCase().trim()] = r[k];
          return acc;
        }, {});

        const name = lower['name'] || lower['nome'] || `Membro ${idx + 1}`;
        const email = lower['email'] || '';
        const birthDateRaw = lower['birthdate'] || lower['nascimento'] || lower['data_nascimento'] || lower['Data de Nascimento'] || '';
        const lastSeenRaw = lower['lastseen'] || lower['data'] || '';

        let birthDate = '';
        if (birthDateRaw) {
          const d = new Date(birthDateRaw);
          if (!isNaN(d)) birthDate = d.toISOString().slice(0, 10);
        }

        let lastSeen = '';
        if (lastSeenRaw) {
          const d = new Date(lastSeenRaw);
          if (!isNaN(d)) lastSeen = d.toISOString().slice(0, 10);
        }

        return {
          id: Utils.generateId(),
          name: String(name).trim(),
          email: String(email).trim(),
          birthDate,
          lastSeen,
          status: 'present',
        };
      });

      State.members.push(...newMembers);
      State.saveToStorage();
      Renderer.renderAll();

      Toast.show(`Importação concluída! ${newMembers.length} membros adicionados.`);
    },

    exportCSV() {
      const header = ['name', 'email', 'birthDate', 'lastSeen', 'status'];
      const rows = [
        header.join(','),
        ...State.members.map(m =>
          [m.name, m.email || '', m.birthDate || '', m.lastSeen || '', m.status]
            .map(c => `"${String(c).replace(/"/g, '""')}"`)
            .join(',')
        )
      ];

      const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `membros_${Utils.todayStr()}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      Toast.show('Arquivo CSV exportado com sucesso!');
    }
  };

  // ========= Inicialização =========
  function init() {
    // Inicializar componentes
    Toast.init();
    ConfirmModal.init();
    MemberModal.init();
    ImportExport.init();

    // Carregar dados
    State.loadFromStorage();

    // Data selecionada
    const selectedDateInput = Utils.$('#selectedDate');
    if (selectedDateInput) {
      selectedDateInput.value = State.selectedDate;
      selectedDateInput.addEventListener('change', (e) => {
        State.selectedDate = e.target.value || Utils.todayStr();
      });
    }

    // Filtro por status
    const filterSelect = Utils.$('#filterSelect');
    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        State.filter = e.target.value;
        Renderer.renderAll();
      });
    }

    // Filtro por idade
    const ageFilterSelect = Utils.$('#ageFilterSelect');
    if (ageFilterSelect) {
      ageFilterSelect.addEventListener('change', (e) => {
        State.ageFilter = e.target.value;
        Renderer.renderAll();
      });
    }

    // Busca
    const searchInput = Utils.$('#searchInput');
    const clearSearch = Utils.$('#clearSearch');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        State.searchTerm = e.target.value.trim();
        if (clearSearch) clearSearch.style.display = State.searchTerm ? 'block' : 'none';
        Renderer.renderAll();
      });
    }

    if (clearSearch) {
      clearSearch.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        State.searchTerm = '';
        clearSearch.style.display = 'none';
        Renderer.renderAll();
      });
    }

    // Botões principais
    const btnNew = Utils.$('#btnNew');
    if (btnNew) btnNew.addEventListener('click', () => MemberModal.open());

    const btnClearAll = Utils.$('#btnClearAll');
    if (btnClearAll) {
      btnClearAll.addEventListener('click', () => {
        ConfirmModal.show(
          'Apagar Todos os Membros',
          'Esta ação não pode ser desfeita. Tem certeza que deseja apagar todos os membros?',
          () => {
            State.clearAll();
            Renderer.renderAll();
          }
        );
      });
    }

    // Render inicial
    Renderer.renderAll();
  }

  // Inicializar quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

