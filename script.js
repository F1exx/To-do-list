class Todo {
  selectors = {
    root: '[data-js-todo]',
    newTaskForm: '[data-js-todo-new-task-form]',
    newTaskInput: '[data-js-todo-new-task-input]',
    searchTaskForm: '[data-js-todo-search-task-form]',
    searchTaskInput: '[data-js-todo-search-task-input]',
    totalTasks: '[data-js-todo-total-tasks]',
    deleteAllButton: '[data-js-todo-delete-all-button]',
    logoutButton: '[data-js-todo-logout-button]',
    list: '[data-js-todo-list]',
    item: '[data-js-todo-item]',
    itemCheckbox: '[data-js-todo-item-checkbox]',
    itemLabel: '[data-js-todo-item-label]',
    itemDeleteButton: '[data-js-todo-item-delete-button]',
    emptyMessage: '[data-js-todo-empty-message]',
  }

  stateClasses = {
    isVisible: 'is-visible',
    isDisappearing: 'is-disappearing',
  }

  apiUrl = 'http://localhost:5000/api'

  constructor() {
    // Check if user is logged in
    const token = localStorage.getItem('auth_token')
    if (!token) {
      window.location.href = 'auth.html'
      return
    }

    this.token = token
    this.rootElement = document.querySelector(this.selectors.root)
    this.newTaskFormElement = this.rootElement.querySelector(this.selectors.newTaskForm)
    this.newTaskInputElement = this.rootElement.querySelector(this.selectors.newTaskInput)
    this.searchTaskFormElement = this.rootElement.querySelector(this.selectors.searchTaskForm)
    this.searchTaskInputElement = this.rootElement.querySelector(this.selectors.searchTaskInput)
    this.totalTasksElement = this.rootElement.querySelector(this.selectors.totalTasks)
    this.deleteAllButtonElement = this.rootElement.querySelector(this.selectors.deleteAllButton)
    this.logoutButtonElement = this.rootElement.querySelector(this.selectors.logoutButton)
    this.listElement = this.rootElement.querySelector(this.selectors.list)
    this.emptyMessageElement = this.rootElement.querySelector(this.selectors.emptyMessage)
    this.state = {
      items: [],
      filteredItems: null,
      searchQuery: '',
    }
    this.loadTodos()
    this.bindEvents()
  }

  async loadTodos() {
    try {
      const response = await fetch(`${this.apiUrl}/todos`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      })

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('auth_token')
          window.location.href = 'auth.html'
          return
        }
        throw new Error('Failed to load todos')
      }

      const items = await response.json()
      this.state.items = items
      this.render()
    } catch (error) {
      console.error('Error loading todos:', error)
      this.emptyMessageElement.textContent = 'Error loading tasks'
    }
  }

  render() {
    this.totalTasksElement.textContent = this.state.items.length

    this.deleteAllButtonElement.classList.toggle(
      this.stateClasses.isVisible,
      this.state.items.length > 0
    )

    const items = this.state.filteredItems ?? this.state.items

    this.listElement.innerHTML = items.map(({ id, title, isChecked }) => `
      <li class="todo__item todo-item" data-js-todo-item>
        <input
          class="todo-item__checkbox"
          id="${id}"
          type="checkbox"
          ${isChecked ? 'checked' : ''}
          data-js-todo-item-checkbox
        />
        <label
          class="todo-item__label"
          for="${id}"
          data-js-todo-item-label
        >
          ${title}
        </label>
        <button
          class="todo-item__delete-button"
          data-js-todo-item-delete-button
          aria-label="Delete"
          title="Delete"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 5L5 15M5 5L15 15" stroke="#757575" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </li>
    `).join('')

    const isEmptyFilteredItems = this.state.filteredItems?.length === 0
    const isEmptyItems = this.state.items.length === 0

    this.emptyMessageElement.textContent =
      isEmptyFilteredItems ? 'Tasks not found'
        : isEmptyItems ? 'There are no tasks yet'
          : ''
  }

  addItem(title) {
    const id = crypto?.randomUUID() ?? Date.now().toString()
    
    fetch(`${this.apiUrl}/todos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({ id, title, isChecked: false })
    })
      .then(response => {
        if (!response.ok) throw new Error('Failed to add todo')
        return response.json()
      })
      .then(todo => {
        this.state.items.push(todo)
        this.render()
      })
      .catch(error => console.error('Error adding todo:', error))
  }

  deleteItem(id) {
    fetch(`${this.apiUrl}/todos/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    })
      .then(response => {
        if (!response.ok) throw new Error('Failed to delete todo')
        this.state.items = this.state.items.filter((item) => item.id !== id)
        this.render()
      })
      .catch(error => console.error('Error deleting todo:', error))
  }

  toggleCheckedState(id) {
    const todo = this.state.items.find(item => item.id === id)
    if (!todo) return

    const newCheckedState = !todo.isChecked

    fetch(`${this.apiUrl}/todos/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({ isChecked: newCheckedState })
    })
      .then(response => {
        if (!response.ok) throw new Error('Failed to update todo')
        return response.json()
      })
      .then(updatedTodo => {
        const itemIndex = this.state.items.findIndex(item => item.id === id)
        if (itemIndex !== -1) {
          this.state.items[itemIndex] = updatedTodo
          this.render()
        }
      })
      .catch(error => console.error('Error updating todo:', error))
  }

  filter() {
    const queryFormatted = this.state.searchQuery.toLowerCase()

    this.state.filteredItems = this.state.items.filter(({ title }) => {
      const titleFormatted = title.toLowerCase()

      return titleFormatted.includes(queryFormatted)
    })

    this.render()
  }

  resetFilter() {
    this.state.filteredItems = null
    this.state.searchQuery = ''
    this.render()
  }

  onNewTaskFormSubmit = (event) => {
    event.preventDefault()

    const newTodoItemTitle = this.newTaskInputElement.value

    if (newTodoItemTitle.trim().length > 0) {
      this.addItem(newTodoItemTitle)
      this.resetFilter()
      this.newTaskInputElement.value = ''
      this.newTaskInputElement.focus()
    }
  }

  onSearchTaskFormSubmit = (event) => {
    event.preventDefault()
  }

  onSearchTaskInputChange = ({ target }) => {
    const value = target.value.trim()

    if (value.length > 0) {
      this.state.searchQuery = value
      this.filter()
    } else {
      this.resetFilter()
    }
  }

  onDeleteAllButtonClick = () => {
    const isConfirmed = confirm('Are you sure you want to delete all?')

    if (isConfirmed) {
      fetch(`${this.apiUrl}/todos/delete-all`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      })
        .then(response => {
          if (!response.ok) throw new Error('Failed to delete all todos')
          this.state.items = []
          this.render()
        })
        .catch(error => console.error('Error deleting all todos:', error))
    }
  }

  onLogoutButtonClick = () => {
    const isConfirmed = confirm('Are you sure you want to logout?')

    if (isConfirmed) {
      fetch(`${this.apiUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      })
        .then(() => {
          localStorage.removeItem('auth_token')
          localStorage.removeItem('user')
          window.location.href = 'auth.html'
        })
        .catch(error => {
          console.error('Error logging out:', error)
          localStorage.removeItem('auth_token')
          localStorage.removeItem('user')
          window.location.href = 'auth.html'
        })
    }
  }

  onClick = ({ target }) => {
    if (target.matches(this.selectors.itemDeleteButton)) {
      const itemElement = target.closest(this.selectors.item)
      const itemCheckboxElement = itemElement.querySelector(this.selectors.itemCheckbox)

      itemElement.classList.add(this.stateClasses.isDisappearing)

      setTimeout(() => {
        this.deleteItem(itemCheckboxElement.id)
      }, 400)
    }
  }

  onChange = ({ target }) => {
    if (target.matches(this.selectors.itemCheckbox)) {
      this.toggleCheckedState(target.id)
    }
  }

  bindEvents() {
    this.newTaskFormElement.addEventListener('submit', this.onNewTaskFormSubmit)
    this.searchTaskFormElement.addEventListener('submit', this.onSearchTaskFormSubmit)
    this.searchTaskInputElement.addEventListener('input', this.onSearchTaskInputChange)
    this.deleteAllButtonElement.addEventListener('click', this.onDeleteAllButtonClick)
    this.logoutButtonElement.addEventListener('click', this.onLogoutButtonClick)
    this.listElement.addEventListener('click', this.onClick)
    this.listElement.addEventListener('change', this.onChange)
  }
}

new Todo()
