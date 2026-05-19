from flask import Flask, request, jsonify
from flask_cors import CORS
from models import db, User, Todo
import os
from datetime import datetime, timedelta
import secrets

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///todo.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'your-secret-key-change-in-production'

db.init_app(app)
CORS(app)

sessions = {}

@app.before_request
def create_tables():
    db.create_all()



@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Missing required fields'}), 400
    
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already exists'}), 400
    
    user = User(username=data['username'], email=data['email'])
    user.set_password(data['password'])
    
    try:
        db.session.add(user)
        db.session.commit()
        
        token = secrets.token_urlsafe(32)
        sessions[token] = {'user_id': user.id, 'expires': datetime.utcnow() + timedelta(days=30)}
        
        return jsonify({
            'message': 'User registered successfully',
            'token': token,
            'user': user.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Missing email or password'}), 400
    
    user = User.query.filter_by(email=data['email']).first()
    
    if not user or not user.check_password(data['password']):
        return jsonify({'error': 'Invalid email or password'}), 401
    
    token = secrets.token_urlsafe(32)
    sessions[token] = {'user_id': user.id, 'expires': datetime.utcnow() + timedelta(days=30)}
    
    return jsonify({
        'message': 'Login successful',
        'token': token,
        'user': user.to_dict()
    }), 200


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if token in sessions:
        del sessions[token]
    return jsonify({'message': 'Logged out successfully'}), 200


@app.route('/api/auth/verify', methods=['GET'])
def verify():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    
    if not token or token not in sessions:
        return jsonify({'error': 'Invalid token'}), 401
    
    session = sessions[token]
    if session['expires'] < datetime.utcnow():
        del sessions[token]
        return jsonify({'error': 'Token expired'}), 401
    
    user = User.query.get(session['user_id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'user': user.to_dict()
    }), 200


def get_user_from_token():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    
    if not token or token not in sessions:
        return None
    
    session = sessions[token]
    if session['expires'] < datetime.utcnow():
        del sessions[token]
        return None
    
    return User.query.get(session['user_id'])


@app.route('/api/todos', methods=['GET'])
def get_todos():
    user = get_user_from_token()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    
    todos = Todo.query.filter_by(user_id=user.id).all()
    return jsonify([todo.to_dict() for todo in todos]), 200


@app.route('/api/todos', methods=['POST'])
def create_todo():
    user = get_user_from_token()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.get_json()
    
    if not data or not data.get('title'):
        return jsonify({'error': 'Missing title'}), 400
    
    todo = Todo(
        id=data.get('id', secrets.token_urlsafe(16)),
        user_id=user.id,
        title=data['title'],
        is_checked=data.get('isChecked', False)
    )
    
    try:
        db.session.add(todo)
        db.session.commit()
        return jsonify(todo.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/todos/<todo_id>', methods=['PUT'])
def update_todo(todo_id):
    user = get_user_from_token()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    
    todo = Todo.query.filter_by(id=todo_id, user_id=user.id).first()
    
    if not todo:
        return jsonify({'error': 'Todo not found'}), 404
    
    data = request.get_json()
    
    if 'title' in data:
        todo.title = data['title']
    if 'isChecked' in data:
        todo.is_checked = data['isChecked']
    
    try:
        db.session.commit()
        return jsonify(todo.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/todos/<todo_id>', methods=['DELETE'])
def delete_todo(todo_id):
    user = get_user_from_token()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    
    todo = Todo.query.filter_by(id=todo_id, user_id=user.id).first()
    
    if not todo:
        return jsonify({'error': 'Todo not found'}), 404
    
    try:
        db.session.delete(todo)
        db.session.commit()
        return jsonify({'message': 'Todo deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/todos/delete-all', methods=['POST'])
def delete_all_todos():
    user = get_user_from_token()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        Todo.query.filter_by(user_id=user.id).delete()
        db.session.commit()
        return jsonify({'message': 'All todos deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'Server is running'}), 200


@app.route('/api/admin/users', methods=['GET'])
def get_all_users():
    """Get all users with their todo count"""
    try:
        users = User.query.all()
        users_data = []
        
        for user in users:
            todo_count = Todo.query.filter_by(user_id=user.id).count()
            completed_count = Todo.query.filter_by(user_id=user.id, is_checked=True).count()
            
            users_data.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'created_at': user.created_at.isoformat(),
                'total_todos': todo_count,
                'completed_todos': completed_count,
                'pending_todos': todo_count - completed_count
            })
        
        return jsonify({
            'total_users': len(users_data),
            'users': users_data
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/user/<username>', methods=['GET'])
def get_user_details(username):
    """Get detailed info about specific user and their todos"""
    try:
        user = User.query.filter_by(username=username).first()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        todos = Todo.query.filter_by(user_id=user.id).all()
        
        return jsonify({
            'user': user.to_dict(),
            'todos': [todo.to_dict() for todo in todos],
            'statistics': {
                'total': len(todos),
                'completed': sum(1 for t in todos if t.is_checked),
                'pending': sum(1 for t in todos if not t.is_checked)
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/statistics', methods=['GET'])
def get_statistics():
    """Get global statistics"""
    try:
        total_users = User.query.count()
        total_todos = Todo.query.count()
        completed_todos = Todo.query.filter_by(is_checked=True).count()
        
        return jsonify({
            'total_users': total_users,
            'total_todos': total_todos,
            'completed_todos': completed_todos,
            'pending_todos': total_todos - completed_todos,
            'avg_todos_per_user': round(total_todos / total_users, 2) if total_users > 0 else 0
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def server_error(error):
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='localhost', port=5000)
